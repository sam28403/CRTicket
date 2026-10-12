import test from 'node:test'
import assert from 'node:assert/strict'
import { stationFallbackTiles, stationMapEmbedUrl, stationMapLocation } from './stationLocationMap.js'

test('车站标记以纬度、经度顺序返回，忽略站名空白', () => {
  const location = stationMapLocation('北京南')
  assert.ok(location[0] > 39 && location[0] < 40)
  assert.ok(location[1] > 116 && location[1] < 117)
  assert.deepEqual(stationMapLocation(' 北 京\u3000南 '), location)
  assert.deepEqual(stationMapLocation('A B', { 'A B': [100, 30], AB: [101, 31] }), [30, 100])
})

test('缺失、非数值、越界和继承属性不会被当成车站坐标', () => {
  for (const value of [[NaN, 30], [100, Infinity], [181, 30], [100, 90], [100], null]) {
    assert.equal(stationMapLocation('无效站', { 无效站: value }), null)
  }
  assert.equal(stationMapLocation('不存在的站'), null)
  assert.equal(stationMapLocation('toString'), null)
})

test('使用 OSM 官方 T 图层的嵌入页面，视野和标记始终定位查询车站', () => {
  for (const station of ['北京南', '上海虹桥', '昆明南']) {
    const url = new URL(stationMapEmbedUrl(station))
    assert.equal(url.origin, 'https://www.openstreetmap.org')
    assert.equal(url.pathname, '/export/embed.html')
    assert.equal(url.searchParams.get('layer'), 'transportmap')
    const [latitude, longitude] = stationMapLocation(station)
    assert.equal(url.searchParams.get('marker'), `${latitude},${longitude}`)
    const [west, south, east, north] = url.searchParams.get('bbox').split(',').map(Number)
    assert.ok(west < longitude && longitude < east)
    assert.ok(south < latitude && latitude < north)
    assert.ok(Math.abs((west + east) / 2 - longitude) < 1e-10)
    assert.ok(Math.abs((south + north) / 2 - latitude) < 1e-10)
  }
  assert.equal(stationMapEmbedUrl('不存在的站'), '')
})

test('备用源独立于官网域名并保留 OSM 署名，支持替换瓦片地址', () => {
  const source = stationFallbackTiles()
  assert.equal(new URL(source.url).hostname, 'a.tile.openstreetmap.fr')
  assert.ok(source.url.includes('/hot/'))
  assert.ok(source.options.attribution.includes('OpenStreetMap'))
  const mirror = 'https://example.cn/{z}/{x}/{y}.png'
  assert.equal(stationFallbackTiles(mirror).url, mirror)
})
