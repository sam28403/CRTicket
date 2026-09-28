import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createTrainInfoRouter, matchesTrain, normalizeStops, queryTrainInfo as queryWithMileage, validateTrainQuery } from './trainInfo.js'
import { isTrainQueryDateInRange, trainQueryRange } from '../../src/utils/trainQueryDate.js'

const emptyDatabase = async () => ({ version: '20261004', trains: new Map() })
const queryTrainInfo = (train, date, fetchImpl) => queryWithMileage(train, date, fetchImpl, emptyDatabase)
const now = Date.parse('2026-09-28T08:00:00+08:00')

const item = { station_train_code: 'G1', train_no: '24000000G10L', from_station: '北京南', to_station: '上海虹桥' }
const rows = [
  { station_name: '北京南', station_train_code: 'G1', arrive_time: '----', start_time: '20:00' },
  { station_name: '南京南', arrive_time: '23:58', start_time: '00:03' },
  { station_name: '上海虹桥', arrive_time: '01:00', start_time: '01:00' },
]
const response = body => ({ ok: true, json: async () => body })

test('校验真实日期及完整车次，双车次精确匹配', () => {
  assert.equal(validateTrainQuery({ train: 'G1', date: '2026-09-28' }, now), '')
  for (const query of [{ train: 'G', date: '2026-09-28' }, { train: ['G1'], date: '2026-09-28' }, { train: 'G1', date: '2026-02-30' }]) {
    assert.ok(validateTrainQuery(query))
  }
  assert.equal(matchesTrain('G10', 'G1'), false)
  assert.equal(matchesTrain('D3068/D3065', 'D3065'), true)
  assert.equal(matchesTrain('D3068/3065', 'D3065'), true)
})

test('北京时间 T-2 至 T+15 包含边界，跨月跨年及午夜一致', () => {
  assert.deepEqual(trainQueryRange(now), { today: '2026-09-28', min: '2026-09-26', max: '2026-10-13' })
  for (const date of ['2026-09-26', '2026-10-13']) {
    assert.equal(validateTrainQuery({ train: 'G1', date }, now), '')
    assert.equal(isTrainQueryDateInRange(date, now), true)
  }
  for (const date of ['2026-09-25', '2026-10-14']) {
    assert.ok(validateTrainQuery({ train: 'G1', date }, now))
    assert.equal(isTrainQueryDateInRange(date, now), false)
  }
  assert.deepEqual(trainQueryRange(Date.parse('2026-12-31T16:00:00Z')),
    { today: '2027-01-01', min: '2026-12-30', max: '2027-01-16' })
  assert.equal(trainQueryRange(Date.parse('2026-12-31T15:59:59Z')).today, '2026-12-31')
})

test('跨午夜停留及始发终到边界，未知里程不填零', () => {
  const stops = normalizeStops(rows, 'G1')
  assert.equal(stops[0].arrival, null)
  assert.equal(stops[1].stay, 5)
  assert.equal(stops[1].train, 'G1')
  assert.equal(stops[2].departure, null)
  assert.equal(stops[2].stay, null)
  assert.equal(stops[2].mileage, null)
  assert.deepEqual(stops.map(stop => stop.arrivalDay), [0, 0, 1])
  assert.throws(() => normalizeStops([{}], 'G1'))
})

test('优先使用官方跨日数，备用接口逐次累计 +1、+2', () => {
  const trip = [rows[0], rows[1], { station_name: '中间站', arrive_time: '01:00', start_time: '01:05' },
    { station_name: '中间站二', arrive_time: '23:00', start_time: '23:05' }, rows[2]]
  assert.deepEqual(normalizeStops(trip, 'G1').map(stop => stop.arrivalDay), [0, 0, 1, 1, 2])
  assert.equal(normalizeStops([rows[0], { ...rows[2], arrive_day_diff: '3' }], 'G1')[1].arrivalDay, 3)
})

test('主查询使用官网脚本参数，跳过模糊命中', async () => {
  const urls = []
  const result = await queryTrainInfo('G1', '2026-09-28', async url => {
    urls.push(new URL(url))
    return response(urls.length === 1 ? { data: [{ ...item, station_train_code: 'G10' }, item] } : { status: true, data: { data: rows } })
  })
  assert.equal(result.stops.length, 3)
  assert.equal(urls.length, 2)
  assert.equal(urls[0].searchParams.get('date'), '20260928')
  assert.equal(urls[1].pathname, '/otn/queryTrainInfo/query')
  assert.equal(urls[1].searchParams.get('leftTicketDTO.train_date'), '2026-09-28')
  assert.equal(result.source, '12306')
})

test('主查询空结果或失败时执行 Gist 备用方法', async () => {
  for (const fail of [false, true]) {
    let count = 0
    const result = await queryTrainInfo('G1', '2026-09-28', async url => {
      count++
      if (count === 1) return response({ data: [item] })
      if (count === 2) {
        if (fail) throw new TypeError('fetch failed')
        return response({ status: true, data: { data: [] } })
      }
      const parsed = new URL(url)
      assert.equal(parsed.pathname, '/otn/czxx/queryByTrainNo')
      assert.equal(parsed.searchParams.get('from_station_telecode'), 'VNP')
      assert.equal(parsed.searchParams.get('to_station_telecode'), 'AOH')
      return response({ status: true, data: { data: rows } })
    })
    assert.equal(count, 3)
    assert.equal(result.source, '12306（Gist 备用方法）')
  }
})

test('区分无结果、异常响应和搜索服务失败', async () => {
  assert.deepEqual((await queryTrainInfo('G1', '2026-09-28', async () => response({ data: [] }))).stops, [])
  await assert.rejects(queryTrainInfo('G1', '2026-09-28', async () => response({ status: false })))
  await assert.rejects(queryTrainInfo('G1', '2026-09-28', async () => response({ data: {} })))
  await assert.rejects(queryTrainInfo('G1', '2026-09-28', async () => response({ data: [item, item] })))
})

test('HTTP 路由校验输入并返回稳定的数据结构', async () => {
  const app = express()
  app.use('/api/train-info', createTrainInfoRouter(async url => response(
    url.includes('/search/v1/') ? { data: [item] } : { status: true, data: { data: rows } }
  ), emptyDatabase))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/api/train-info`
  try {
    const invalid = await fetch(`${url}?train=G1&date=2026-02-30`)
    assert.equal(invalid.status, 400)
    const valid = await fetch(`${url}?train=g1&date=${trainQueryRange().today}`)
    assert.equal(valid.status, 200)
    const body = await valid.json()
    assert.equal(body.success, true)
    assert.equal(body.stops.length, 3)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

function mileageDatabase(stops = normalizeStops(rows, 'G1').map((stop, index) => ({ ...stop, mileage: [0, 1023, 1318][index] }))) {
  return async () => ({ version: '20261004', trains: new Map([['G1', { train: 'G1', stops }]]) })
}

const onlineFetch = async url => response(url.includes('/search/v1/') ? { data: [item] } : { status: true, data: { data: rows } })

test('里程按完整站序匹配，保留 12306 时刻并标明数据版本', async () => {
  const offline = normalizeStops(rows, 'G1').map((stop, index) => ({ ...stop, arrival: '10:00', mileage: [0, 1023, 1318][index] }))
  const result = await queryWithMileage('G1', '2026-09-28', onlineFetch, mileageDatabase(offline))
  assert.deepEqual(result.stops.map(stop => stop.mileage), [0, 1023, 1318])
  assert.equal(result.stops[1].arrival, '23:58')
  assert.equal(result.mileageVersion, '20261004')
  assert.equal(result.source, '12306')
})

test('站序不一致、里程异常或数据下载失败均保留在线结果，不错误拼接', async () => {
  const stops = normalizeStops(rows, 'G1').map((stop, index) => ({ ...stop, mileage: index * 100 }))
  for (const loader of [mileageDatabase(stops.toReversed()), mileageDatabase(stops.slice(1)),
    mileageDatabase(stops.map(stop => ({ ...stop, mileage: null }))), async () => { throw new Error('network') }]) {
    const result = await queryWithMileage('G1', '2026-09-28', onlineFetch, loader)
    assert.equal(result.stops.length, 3)
    assert.ok(result.stops.every(stop => stop.mileage === null))
    assert.equal(result.warnings.length, 1)
  }
})

test('12306 无结果或不可用时返回有明确提示的路路通离线参考', async () => {
  for (const fetchImpl of [async () => response({ data: [] }), async () => { throw new TypeError('offline') }]) {
    const result = await queryWithMileage('G1', '2026-09-28', fetchImpl, mileageDatabase())
    assert.equal(result.stops.at(-1).mileage, 1318)
    assert.equal(result.source, '路路通（离线参考）')
    assert.match(result.warnings[0], /不能确认所选日期是否开行/)
  }
})
