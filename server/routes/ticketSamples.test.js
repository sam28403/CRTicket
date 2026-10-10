import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { parseTicketFares } from './ticketFares.js'
import { queryTicketPrices } from './leftTicketClient.js'
import { createTicketSamplesRouter, queryTicketSample, sampleInterval } from './ticketSamples.js'
import { trainQueryRange } from '../../src/utils/trainQueryDate.js'
import { buildDebugTicket } from '../../src/utils/debugTickets.js'
import { buildTicketPayload, themeOptions } from '../../src/utils/ticketShared.js'

const { today } = trainQueryRange()
const nextDate = date => new Date(Date.parse(`${date}T00:00:00Z`) + 86400000)
  .toISOString().slice(0, 10)
const stops = [
  { no: '01', station: '北京南', arrival: null, departure: '23:50', arrivalDay: 0, mileage: 0 },
  { no: '02', station: '天津南', arrival: '23:59', departure: '00:05', arrivalDay: 0, mileage: 122 },
  { no: '03', station: '上海虹桥', arrival: '08:00', departure: null, arrivalDay: 1, mileage: 1318 },
]
const offline = {
  train: 'G1', stops,
  schedule: { startDate: today, endDate: nextDate(today), rule: null },
}
const database = { version: '20261013', trains: new Map([['G1', offline]]) }

function fields() {
  const row = Array(56).fill('')
  Object.assign(row, {
    1: '预订', 2: '24000000G100', 3: 'G1', 6: 'VNP', 7: 'AOH',
    8: '23:50', 9: '08:00', 10: '08:10', 11: 'Y', 13: today.replaceAll('-', ''),
    16: '01', 17: '03', 26: '无', 30: '有', 31: '无', 35: 'OM',
    39: 'O052500021M088300000',
  })
  return row
}

test('按官方元角编码解析席别，区分动车卧铺和无座，拒绝缺失与矛盾报价', () => {
  const row = fields()
  Object.assign(row, { 23: '有', 28: '有', 26: '有', 35: 'OIJ',
    39: 'O052500021I088300021J068500021O052503088' })
  assert.deepEqual(parseTicketFares(row), [
    { seatType: '二等座', price: 525 },
    { seatType: '一等卧', price: 883 },
    { seatType: '二等卧', price: 685 },
    { seatType: '无座', price: 525 },
  ])
  row[39] = 'O052500021O053500021'
  assert.deepEqual(parseTicketFares(row), [])
  row[39] = 'broken'
  assert.deepEqual(parseTicketFares(row, { O: '¥525.0', I: '￥883.5', J: 'unknown' }), [
    { seatType: '二等座', price: 525 }, { seatType: '一等卧', price: 883.5 },
  ])
  row[30] = '--'
  assert.equal(parseTicketFares(row, { O: '¥525.0' }).length, 0)
  row[30] = '有'
  row[35] = 'OM'
  assert.equal(parseTicketFares(row, { O: '0', M: '88300' }).length, 0)
})

test('跨午夜停站按实际发车日顺延，里程差与站序正确，缺失信息不填随机数', () => {
  const draws = [0.75, 0]
  const interval = sampleInterval(stops, today, () => draws.shift())
  assert.equal(interval.from.station, '天津南')
  assert.equal(interval.to.station, '上海虹桥')
  assert.equal(interval.travelDate, nextDate(today))
  assert.equal(interval.to.mileage - interval.from.mileage, 1196)
  assert.equal(sampleInterval(stops.map(stop => ({ ...stop, mileage: null })), today), null)
  assert.equal(sampleInterval([stops[0], { ...stops[2], mileage: -1 }], today), null)
  const outOfWindow = nextDate(trainQueryRange().max)
  assert.equal(sampleInterval(stops, outOfWindow), null)
})

async function sample(row = fields(), extras = {}) {
  const sequence = [0, 0, 0.99]
  let calls = 0
  const result = await queryTicketSample(today, {
    random: () => sequence.shift() ?? 0,
    loadDatabase: async () => database,
    trainQuery: async () => ({ source: '12306', stops, mileageVersion: database.version }),
    fetchImpl: async () => ++calls === 1
      ? new Response("var CLeftTicketUrl = 'leftTicket/queryG';")
      : calls === 2
        ? Response.json({ status: true, data: {
          result: [row.join('|')], map: { VNP: '北京南', AOH: '上海虹桥' },
        } })
        : Response.json({ status: true, data: { O: '¥525.0' } }),
    ...extras,
  })
  return { result, calls }
}

test('在线时刻、始发日期、站序和报价唯一匹配后才生成完整样本', async () => {
  const { result, calls } = await sample()
  assert.equal(calls, 2)
  assert.equal(result.sample.trainNo, 'G1')
  assert.equal(result.sample.distance, 1318)
  assert.equal(result.sample.time, '23:50')
  assert.deepEqual(result.sample.fares, [
    { seatType: '二等座', price: 525 }, { seatType: '一等座', price: 883 },
  ])
  for (const [key, value] of [[13, '20000101'], [16, '02'], [8, '22:00'], [11, 'N']]) {
    const row = fields()
    row[key] = value
    assert.equal((await sample(row)).result.sample, null)
  }
  assert.equal((await sample(fields(), {
    trainQuery: async () => ({ source: '路路通（离线参考）', stops, mileageVersion: database.version }),
  })).result.sample, null)
})

test('缺少余票报价时调用独立票价查询，公布的零余票席别可保留真实报价', async () => {
  const row = fields()
  row[39] = ''
  const { result, calls } = await sample(row)
  assert.equal(calls, 3)
  assert.deepEqual(result.sample.fares, [{ seatType: '二等座', price: 525 }])
  const prices = await queryTicketPrices(row, today, { Cookie: 'test' }, async (url, options) => {
    const params = new URL(url).searchParams
    assert.equal(params.get('train_no'), row[2])
    assert.equal(params.get('from_station_no'), '01')
    assert.equal(params.get('train_date'), today)
    assert.equal(options.headers.Cookie, 'test')
    return Response.json({ status: true, data: { O: '¥525.0' } })
  })
  assert.equal(prices.O, '¥525.0')
  await assert.rejects(queryTicketPrices(row, today, {}, async () =>
    Response.json({ status: false, data: {} })))
})

test('界面生成的装饰字段遵循约定，席别与票价始终成对保存', async () => {
  const { result } = await sample()
  const sampleValue = result.sample
  for (let i = 0; i < 30; i++) {
    const ticket = buildDebugTicket(sampleValue)
    assert.equal(ticket.sellPlace, '网')
    assert.equal(ticket.gate, '')
    assert.equal(ticket.useCredit, 0)
    assert.equal(ticket.date, today.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日'))
    assert.ok(themeOptions.some(theme => theme.id === ticket.theme && !theme.disabled))
    assert.ok(sampleValue.fares.some(fare => fare.seatType === ticket.seatType && fare.price === ticket.price))
    const payload = buildTicketPayload(ticket, { distance: ticket.distance })
    assert.equal(payload.distance, 1318)
    assert.equal(payload.seat_type, ticket.seatType)
  }
})

test('样本 HTTP 接口拒绝非法日期，数据源不可用时不生成假数据', async () => {
  const app = express()
  let calls = 0
  app.use('/samples', createTicketSamplesRouter({ loadDatabase: async () => {
    calls++
    throw new Error('数据源不可用')
  } }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const base = `http://127.0.0.1:${server.address().port}/samples`
    for (const date of ['2026-02-30', '2000-01-01']) {
      assert.equal((await fetch(`${base}?date=${date}`)).status, 400)
    }
    assert.equal(calls, 0)
    const response = await fetch(`${base}?date=${today}`)
    assert.equal(response.status, 502)
    assert.equal((await response.json()).success, false)
    assert.equal(calls, 1)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
