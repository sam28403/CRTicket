import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as echarts from 'echarts'
import { loadChinaMap } from './stationCoordinates.js'
import { createRailwayGeo } from './railwayMap.js'
import { buildTrainRouteData, trainRouteViewport } from './trainRouteMap.js'

const originalFetch = globalThis.fetch
try {
  globalThis.fetch = async url => ({
    json: async () => JSON.parse(await readFile(new URL(`../../../public${url}`, import.meta.url), 'utf8'))
  })
  assert.equal(await loadChinaMap(echarts), true)
} finally {
  globalThis.fetch = originalFetch
}

test('按查询站序标记所有站点，连线保留折返和重复站点', () => {
  const stops = ['北京南', '济南西', '南京南', '上海虹桥', '南京南'].map((station, index) => ({
    station, no: index + 1, arrival: '12:00', departure: '12:05', arrivalDay: 1
  }))
  const route = buildTrainRouteData(stops)
  assert.deepEqual(route.points.map(point => point.name), stops.map(stop => stop.station))
  assert.equal(route.lines.length, 4)
  assert.deepEqual(route.lines[3].coords, [route.points[3].value, route.points[4].value])
  assert.equal(route.points[0].isFirst, true)
  assert.equal(route.points.at(-1).isLast, true)
  assert.equal(route.points[1].arrivalDay, 1)
  assert.deepEqual(route.missingStations, [])
})

test('环线重复站名中的空白不影响坐标匹配，保留各次停靠和闭合连线', () => {
  for (const station of ['济 南', ' 济\u3000南 ', '济\u00a0南', '济\t 南']) {
    const route = buildTrainRouteData([
      { station: '济南', no: '01', departure: '08:00' },
      { station: '济南西', no: '02', arrival: '08:30', departure: '08:35' },
      { station, no: '03', arrival: '12:00' }
    ])
    assert.deepEqual(route.missingStations, [])
    assert.equal(route.points.length, 3)
    assert.equal(route.lines.length, 2)
    assert.deepEqual(route.points[0].value, route.points[2].value)
    assert.equal(route.points[2].name, station.trim())
    assert.equal(route.points[2].no, '03')
    assert.equal(route.points[2].arrival, '12:00')
    assert.equal(route.points[2].isLast, true)
    assert.deepEqual(route.lines[1].coords, [route.points[1].value, route.points[0].value])
  }
  const route = buildTrainRouteData([{ station: 'Example Station' }], {
    'Example Station': [100, 30], ExampleStation: [101, 31]
  })
  assert.deepEqual(route.points[0].value, [100, 30], '优先使用原名的精确坐标')
})

test('补充站点及用户别名在查询地图中均可定位并按站序连线', () => {
  const names = ['常村', '古城子', '天桥', '遥林', '林头子', '铁厂', '桥头', '青沟子', '三家子',
    '龙池', '大柴旦东', '饮马峡', '蒋村']
  const route = buildTrainRouteData(names.map(station => ({ station })))
  assert.deepEqual(route.missingStations, [])
  assert.deepEqual(route.points.map(point => point.name), names)
  assert.equal(route.lines.length, names.length - 1)
  assert.deepEqual(route.points[1].value, route.points[2].value)
  assert.deepEqual(route.points[3].value, route.points[4].value)
  assert.deepEqual(route.points[10].value, route.points[11].value)
  assert.deepEqual(route.points[12].value, [113.027942, 38.532911])
})

test('缺失坐标时展示站名，保留其他站点且不跨过未知站点连线', () => {
  const route = buildTrainRouteData([
    { station: '甲' }, { station: '乙' }, { station: '未知站' }, { station: '丙' }, { station: '丁' }
  ], { 甲: [100, 30], 乙: [101, 31], 丙: [102, 32], 丁: [103, 33] })
  assert.deepEqual(route.points.map(point => point.name), ['甲', '乙', '丙', '丁'])
  assert.deepEqual(route.lines.map(line => line.coords), [
    [[100, 30], [101, 31]], [[102, 32], [103, 33]]
  ])
  assert.deepEqual(route.missingStations, ['未知站'])
  assert.deepEqual(buildTrainRouteData([]), { points: [], lines: [], missingStations: [] })
  assert.equal(buildTrainRouteData([{ station: '无效' }], { 无效: [NaN, 30] }).points.length, 0)
})

test('桌面和手机上的横向、纵向、单站及全国线路均完整居中', () => {
  const routes = [
    [[100, 30], [120, 30]],
    [[110, 20], [110, 45]],
    [[110, 30]],
    [[110, 30], [110, 30]],
    [[87.6, 43.8], [106.5, 29.5], [121.3, 31.2]],
    [[102.6, 17.9], [102.7, 18]]
  ]
  for (const [width, height] of [[1100, 500], [320, 380]]) {
    for (const values of routes) {
      const points = values.map(value => ({ value }))
      const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height })
      try {
        const viewport = trainRouteViewport(points, width, height)
        chart.setOption({ geo: createRailwayGeo(viewport) })
        const pixels = values.map(value => chart.convertToPixel({ geoIndex: 0 }, value))
        for (const [x, y] of pixels) {
          assert.ok(x >= 24 && x <= width - 24, `站点横坐标越界：${x}`)
          assert.ok(y >= 60 && y <= height - 24, `站点纵坐标越界：${y}`)
        }
        const midpoint = [
          (Math.min(...pixels.map(p => p[0])) + Math.max(...pixels.map(p => p[0]))) / 2,
          (Math.min(...pixels.map(p => p[1])) + Math.max(...pixels.map(p => p[1]))) / 2
        ]
        assert.ok(Math.abs(midpoint[0] - width / 2) < 0.001)
        assert.ok(Math.abs(midpoint[1] - (height / 2 + 18)) < 0.001)
        chart.dispatchAction({ type: 'geoRoam', componentType: 'geo', geoIndex: 0, dx: 80, dy: 30 })
        chart.setOption({ geo: trainRouteViewport(points, width, height) })
        const restored = chart.convertToPixel({ geoIndex: 0 }, values[0])
        assert.ok(Math.abs(restored[0] - pixels[0][0]) < 0.001)
        assert.ok(Math.abs(restored[1] - pixels[0][1]) < 0.001)
        assert.ok(chart.renderToSVGString().includes('<svg'))
      } finally {
        chart.dispose()
      }
    }
  }
  assert.deepEqual(trainRouteViewport([], 320, 380), {})
})

test('缩小或拖离线路后，画布边缘仍能拖动和缩放，并可恢复线路居中', () => {
  const width = 1000
  const height = 500
  const points = [[116.3, 39.8], [117.0, 36.6]].map(value => ({ value }))
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height })
  try {
    chart.setOption({ animation: false, geo: createRailwayGeo(trainRouteViewport(points, width, height)) })
    const initial = chart.convertToPixel({ geoIndex: 0 }, points[0].value)
    chart.dispatchAction({ type: 'geoRoam', geoIndex: 0, zoom: 0.1, originX: width / 2, originY: height / 2 })
    const geo = chart.getModel().getComponent('geo').coordinateSystem
    assert.equal(geo.containPoint([10, 10]), false, '测试操作位置应在线路包围盒之外')

    const zr = chart.getZr()
    zr.trigger('mousedown', { offsetX: 10, offsetY: 10, event: { button: 0 } })
    const beforePan = chart.convertToPixel({ geoIndex: 0 }, points[0].value)
    zr.trigger('mousemove', { offsetX: 90, offsetY: 40, event: { preventDefault() {}, stopPropagation() {} } })
    zr.trigger('mouseup', { offsetX: 90, offsetY: 40, event: { button: 0 } })
    const afterPan = chart.convertToPixel({ geoIndex: 0 }, points[0].value)
    assert.ok(Math.abs(afterPan[0] - beforePan[0] - 80) < 0.001)
    assert.ok(Math.abs(afterPan[1] - beforePan[1] - 30) < 0.001)

    const beforeZoom = chart.getOption().geo[0].zoom
    zr.trigger('mousewheel', {
      offsetX: width - 10, offsetY: height - 10, wheelDelta: 1,
      event: { preventDefault() {}, stopPropagation() {} }
    })
    assert.ok(chart.getOption().geo[0].zoom > beforeZoom, '画布边缘的滚轮应触发缩放')

    chart.setOption({ geo: trainRouteViewport(points, width, height) })
    const restored = chart.convertToPixel({ geoIndex: 0 }, points[0].value)
    assert.ok(Math.abs(restored[0] - initial[0]) < 0.001)
    assert.ok(Math.abs(restored[1] - initial[1]) < 0.001)
  } finally {
    chart.dispose()
  }
})

test('复用底图保留此前海南、东沙和南海插图的隐藏效果', () => {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 1000, height: 500 })
  try {
    chart.setOption({ geo: createRailwayGeo() })
    const model = chart.getModel().getComponent('geo')
    assert.equal(model.coordinateSystem.getRegion('海南省').geometries.length, 1)
    assert.equal(model.coordinateSystem.getRegion('广东省').geometries.length, 20)
    const inset = chart.getViewOfComponentModel(model)._mapDraw._regionsGroupByName.get('南海诸岛')
    assert.equal(inset.silent, true)
    inset.traverse(element => {
      if (element.type !== 'compound') return
      assert.equal(element.style.opacity, 0)
      for (const state of ['emphasis', 'select', 'blur']) assert.equal(element.states[state].style.opacity, 0)
    })
  } finally {
    chart.dispose()
  }
})
