import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createStationRouter, queryStation } from './station.js'
import { normalizeStationTrains, query12306Station } from './station12306.js'
import { listLltStation } from './stationLlt.js'

const station = { name: '北京南', telecode: 'VNP' }
const date = '2026-10-11'
const now = Date.parse(`${date}T12:00:00+08:00`)
const schedule = { startDate: '2026-10-01', endDate: '2026-10-31', rule: null }
const onlineRow = {
  train_no: '24000000G10A', station_train_code: 'G1',
  station_name: station.name, start_station_name: '北京南', end_station_name: '上海',
  arrive_time: '----', start_time: '08:00', start_start_time: '08:00',
  end_arrive_time: '15:00', start_train_date: date,
}

function databaseFor(items) {
  return { version: '20261011', trains: new Map(items.map(item => [item.train, item])) }
}

test('官网请求使用本站参数和初始化会话，时刻只取本站字段', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url: new URL(url), options })
    return url.endsWith('/init')
      ? new Response('init', { headers: { 'Set-Cookie': 'session=test; Path=/' } })
      : Response.json({ status: true, data: { flag: true, data: [{
        ...onlineRow, start_station_name: '天津', arrive_time: '07:55',
        start_start_time: '06:00', checkin: 'A1', late_status: '晚点 5 分钟',
      }] } })
  }
  const rows = await query12306Station(station, date, fetchImpl)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url.pathname, '/otn/czxx/query')
  assert.equal(calls[1].url.searchParams.get('train_station_code'), 'VNP')
  assert.equal(calls[1].url.searchParams.get('train_station_name'), '北京南')
  assert.equal(calls[1].url.searchParams.get('train_start_date'), date)
  assert.equal(calls[1].options.headers.Cookie, 'session=test')
  assert.equal(rows[0].arrival, '07:55')
  assert.equal(rows[0].departure, '08:00')
  assert.equal(rows[0].stay, 5)
  assert.equal(rows[0].ticketGate, 'A1')
  assert.equal(rows[0].departureStatus, '晚点 5 分钟')
  assert.equal(rows[0].exit, null)
})

test('官方缺失动态数据不猜测正点，错误站点、格式及 HTTP 失败触发异常', async () => {
  const rows = normalizeStationTrains([onlineRow], station, date)
  assert.equal(rows[0].arrival, null)
  assert.equal(rows[0].arrivalLabel, '始发站')
  assert.equal(rows[0].departureStatus, null)
  assert.equal(rows[0].ticketGate, null)
  assert.throws(() => normalizeStationTrains({}, station, date))
  assert.throws(() => normalizeStationTrains([{ ...onlineRow, station_name: '北京' }], station, date))
  assert.throws(() => normalizeStationTrains([{ ...onlineRow, start_time: '--' }], station, date))
  await assert.rejects(query12306Station(station, date, async url => url.endsWith('/init')
    ? new Response('') : new Response('', { status: 404 })), /HTTP 404/)
})

test('官方终到、跨午夜停车只进入当天相应大屏', () => {
  const terminal = normalizeStationTrains([{
    ...onlineRow, start_station_name: '天津', end_station_name: '北京南',
    arrive_time: '09:00', start_time: '09:00',
  }], station, date)[0]
  assert.equal(terminal.departure, null)
  assert.equal(terminal.departureLabel, '终到站')
  const overnight = normalizeStationTrains([{
    ...onlineRow, start_station_name: '天津', arrive_time: '23:55', start_time: '00:05',
  }], station, date)[0]
  assert.equal(overnight.arrival, '23:55')
  assert.equal(overnight.departure, null)
  assert.equal(overnight.departureLabel, '次日 00:05')
  assert.equal(overnight.stay, 10)
})

test('路路通按本站到发日反推始发日，保留同站重复停靠并遵守循环开行规则', () => {
  const items = [
    {
      train: 'K1',
      schedule: { ...schedule, startDate: '2026-10-10', endDate: '2026-10-10' },
      stops: [
        { station: '天津', departure: '22:00', departureDay: 0 },
        { station: '北 京南', arrival: '00:05', departure: '00:10', arrivalDay: 1, departureDay: 1, stay: 5 },
        { station: '上海', arrival: '12:00', arrivalDay: 1 },
      ],
    },
    {
      train: 'K2', schedule,
      stops: [
        { station: '天津', departure: '22:00', departureDay: 0 },
        { station: '北京南', arrival: '23:55', departure: '00:05', arrivalDay: 0, departureDay: 1, stay: 10 },
        { station: '上海', arrival: '12:00', arrivalDay: 1 },
      ],
    },
    {
      train: 'G3/G4', schedule,
      stops: [
        { station: '北京南', departure: '08:00', departureDay: 0 },
        { station: '天津', arrival: '09:00', departure: '09:10', arrivalDay: 0, departureDay: 0 },
        { station: '北京南', arrival: '10:00', arrivalDay: 0 },
      ],
    },
    {
      train: 'G5', schedule: { ...schedule, rule: { period: 2, mask: 2 } },
      stops: [{ station: '北京南', departure: '12:00', departureDay: 0 }],
    },
  ]
  const database = databaseFor(items)
  const rows = listLltStation(database, station.name, date)
  assert.equal(rows.length, 5)
  assert.equal(rows[0].trainDate, '2026-10-10')
  assert.equal(rows[0].arrival, '00:05')
  const overnight = rows.filter(row => row.train === 'K2')
  assert.equal(overnight.length, 2)
  assert.equal(overnight[0].arrival, '23:55')
  assert.equal(overnight[0].departure, null)
  assert.equal(overnight[1].arrival, null)
  assert.equal(overnight[1].departure, '00:05')
  assert.equal(overnight[1].arrivalLabel, '昨日 23:55')
  assert.equal(new Set(rows.map(row => row.id)).size, 5)
  assert.deepEqual(listLltStation(database, '不存在的站', date), [])
})

test('优先返回官方数据；官方失败或空结果后才尝试路路通', async () => {
  const order = []
  const database = databaseFor([{ train: 'G1', schedule, stops: [
    { station: '北京南', departure: '08:00', departureDay: 0 },
    { station: '上海', arrival: '15:00', arrivalDay: 0 },
  ] }])
  const loadDatabase = async () => { order.push('llt'); return database }
  const online = await queryStation(station, date, {
    queryOnline: async () => { order.push('12306'); return [onlineRow] }, loadDatabase,
  })
  assert.equal(online.source, '12306')
  assert.deepEqual(order, ['12306'])
  for (const queryOnline of [async () => [], async () => { throw new Error('offline') }]) {
    const result = await queryStation(station, date, { queryOnline, loadDatabase })
    assert.equal(result.source, '路路通')
    assert.equal(result.trains.length, 1)
    assert.equal(result.version, database.version)
    assert.equal(result.trains[0].ticketGate, null)
    assert.equal(result.warnings.length, 2)
  }
})

test('HTTP 限制当天和有效站名，合并并发请求，缓存到期和跨日重新查询', async () => {
  let time = now
  let calls = 0
  const options = {
    now: () => time,
    queryOnline: async () => {
      calls++
      await new Promise(resolve => setTimeout(resolve, 10))
      return normalizeStationTrains([onlineRow], station, date)
    },
  }
  const app = express()
  app.use('/station', createStationRouter(options))
  app.use('/failure', createStationRouter({
    now: () => now,
    queryOnline: async () => { throw new Error('online') },
    loadDatabase: async () => { throw new Error('offline') },
  }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    const query = `station=${encodeURIComponent('北京南')}&date=${date}`
    for (const invalid of ['station=VNP', 'station=北京南&date=2026-10-10', 'station=北京南&station=天津']) {
      assert.equal((await fetch(`${base}/station?${invalid}`)).status, 400)
    }
    const responses = await Promise.all(Array.from({ length: 5 }, () => fetch(`${base}/station?${query}`)))
    assert.equal(calls, 1)
    for (const response of responses) {
      const body = await response.json()
      assert.equal(body.success, true)
      assert.equal(body.station, '北京南')
      assert.equal(body.date, date)
      assert.equal(body.total, 1)
    }
    await fetch(`${base}/station?${query}`)
    assert.equal(calls, 1)
    time += 60001
    await fetch(`${base}/station?${query}`)
    assert.equal(calls, 2)
    time = Date.parse('2026-10-12T00:00:00+08:00')
    assert.equal((await fetch(`${base}/station?${query}`)).status, 400)
    const nextDay = await (await fetch(`${base}/station?station=北京南`)).json()
    assert.equal(nextDay.date, '2026-10-12')
    assert.equal(calls, 3)
    assert.equal((await fetch(`${base}/failure?${query}`)).status, 502)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
