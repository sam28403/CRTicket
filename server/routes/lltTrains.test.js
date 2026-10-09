import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createLltTrainsRouter, listLltTrains, runsOnDate, validListDate } from './lltTrains.js'

const daily = { startDate: '2026-09-24', endDate: '2026-10-10', rule: null }
const stops = [
  { station: '始发站', departure: '20:00', arrivalDay: 0, mileage: 0 },
  { station: '终到站', arrival: '01:05', arrivalDay: 2, mileage: 1318 },
]

test('日期不限查询窗口，校验闰日并按生效区间与循环掩码筛选', () => {
  assert.ok(validListDate('2000-02-29'))
  assert.ok(validListDate('2099-12-31'))
  for (const date of ['2026-02-29', '2026-13-01', '2026-1-01', ['2026-10-08']]) assert.equal(validListDate(date), false)
  assert.equal(runsOnDate(daily, '2026-09-23'), false)
  assert.equal(runsOnDate(daily, '2026-09-24'), true)
  assert.equal(runsOnDate(daily, '2026-10-10'), true)
  assert.equal(runsOnDate(daily, '2026-10-11'), false)
  assert.equal(runsOnDate(null, '2026-10-08'), false)
  const alternate = { ...daily, rule: { period: 2, mask: 1 } }
  assert.equal(runsOnDate(alternate, '2026-09-24'), true)
  assert.equal(runsOnDate(alternate, '2026-09-25'), false)
  assert.equal(runsOnDate(alternate, '2026-09-26'), true)
  // 第 31 位不能受到有符号位运算的影响。
  assert.equal(runsOnDate({
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    rule: { period: 31, mask: 2 ** 30 },
  }, '2026-10-01'), true)
})

test('指定类别与数字排序，保留多车次和后缀，跨日历时与缺失里程正确展示', () => {
  const codes = ['1461', 'K10', 'T1', 'Z1', 'S1', 'C1', 'D1', 'G10', 'G2', 'L1', 'G2B', 'G3/G4', 'Y1']
  const trains = new Map(codes.map(train => [train, { train, schedule: daily, stops }]))
  trains.set('G99', { train: 'G99', schedule: { ...daily, endDate: '2026-10-07' }, stops })
  trains.set('G100', {
    train: 'G100',
    schedule: daily,
    stops: [
      { ...stops[0], departure: '00:03', departureDay: 1 },
      { ...stops[1], arrivalDay: 1, mileage: null },
    ],
  })
  const result = listLltTrains({ version: '20261010', trains }, '2026-10-08')
  assert.deepEqual(result.trains.map(row => row.train), [
    'G2', 'G2B', 'G3/G4', 'G10', 'G100', 'D1', 'C1',
    'S1', 'Z1', 'T1', 'K10', 'L1', '1461', 'Y1',
  ])
  assert.equal(result.total, 14)
  assert.deepEqual(result.trains[0], { train: 'G2', from: '始发站', to: '终到站', duration: '29:05', stationCount: 2, mileage: 1318 })
  assert.equal(result.trains[4].duration, '01:02')
  assert.equal(result.trains[4].mileage, null)
})

test('列表 HTTP 接口验证输入、返回摘要并报告数据源故障', async () => {
  const database = { version: '20261010', trains: new Map([['G1', { train: 'G1', schedule: daily, stops }]]) }
  const app = express()
  app.use('/api/llt-trains', createLltTrainsRouter(async () => database))
  app.use('/variants', createLltTrainsRouter(async () => ({ version: '20261010', trains: new Map([
    ['G1/G2B', { train: 'G1/G2B', schedule: { startDate: '2000-01-01', endDate: '2099-12-31', rule: null }, stops }],
    ['G1/G2', { train: 'G1/G2', schedule: daily, stops: [{ ...stops[0], station: '其他方案' }, stops[1]] }],
  ]) })))
  app.use('/failure', createLltTrainsRouter(async () => { throw new Error('offline') }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    assert.equal((await fetch(`${base}/api/llt-trains?date=2026-02-29`)).status, 400)
    for (let i = 0; i < 2; i++) {
      const response = await fetch(`${base}/api/llt-trains?date=2026-10-08`)
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.total, 1)
      assert.equal(body.trains[0].train, 'G1')
      assert.equal(body.trains[0].stationCount, stops.length)
      assert.equal(body.trains[0].stops, undefined)
    }
    assert.equal((await fetch(`${base}/api/llt-trains?date=1900-01-01`)).status, 200)
    assert.equal((await fetch(`${base}/failure?date=2026-10-08`)).status, 502)
    const detail = await fetch(`${base}/variants/detail?train=G1%2FG2B&date=2000-02-29`)
    assert.equal(detail.status, 200)
    const body = await detail.json()
    assert.equal(body.train, 'G1/G2B')
    assert.equal(body.date, '2000-02-29')
    assert.equal(body.from, '始发站')
    assert.equal(body.to, '终到站')
    assert.equal(body.mileageVersion, '20261010')
    assert.deepEqual(body.stops, stops)
    const stopped = await fetch(`${base}/api/llt-trains/detail?train=G1&date=2026-10-11`)
    assert.deepEqual((await stopped.json()).stops, [])
    const missing = await fetch(`${base}/variants/detail?train=G1B&date=2026-10-08`)
    assert.deepEqual((await missing.json()).stops, [])
    assert.equal((await fetch(`${base}/variants/detail?train=G1%2FG2B&date=2000-02-30`)).status, 400)
    assert.equal((await fetch(`${base}/variants/detail?train=G1&train=G2&date=2026-10-08`)).status, 400)
    assert.equal((await fetch(`${base}/failure/detail?train=G1&date=2026-10-08`)).status, 502)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
