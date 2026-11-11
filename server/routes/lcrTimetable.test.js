import assert from 'node:assert/strict'
import test from 'node:test'
import { createLcrTimetableLoader, queryLcrTimetable } from './lcrTimetable.js'
import { queryTrainInfo } from './trainInfo.js'

const date = '2026-11-11'
const stops = [
  { code: 'LAVTM', station: 'Vientiane', country: 'LA', utcOffset: '+07:00', arrive: null, depart: '23:45' },
  { code: 'LAVMM', station: 'Kasi', country: 'LA', utcOffset: '+07:00', arrive: '23:57', depart: '00:03' },
  { code: 'LAVBM', station: 'Boten', country: 'LA', utcOffset: '+07:00', arrive: '01:10', depart: null },
]
const trip = { train: 'C85', runsOn: [date], stops }
const response = data => ({ ok: true, json: async () => data })
const feed = (checkedAt = '2026-11-10T23:00:07Z', trains = [trip]) => ({ checkedAt, trains })

test('按 runsOn 区分同号时刻、合并重复记录、排除 D 字头并翻译站名', async () => {
  const changed = { ...trip, runsOn: ['2026-11-12'], stops: stops.toReversed().map(stop => ({
    ...stop, arrive: stop.depart, depart: stop.arrive,
  })) }
  const load = createLcrTimetableLoader(async () => response(feed(undefined, [
    trip, trip, changed, { ...trip, train: 'D85' },
  ])))
  const [result, ...others] = await queryLcrTimetable('C85', date, load)
  assert.equal(others.length, 0)
  assert.equal(result.timeZone, 'vientiane')
  assert.deepEqual(result.stops.map(stop => stop.station), ['万象', '嘎西', '磨丁'])
  assert.deepEqual(result.stops.map(stop => stop.mileage), [0, 167, 406])
  assert.equal(result.stops[1].stay, 6)
  assert.equal(result.stops[1].departureDay, 1)
  const [reverse] = await queryLcrTimetable('C85', '2026-11-12', load)
  assert.equal(reverse.from, '磨丁')
  assert.deepEqual(reverse.stops.map(stop => stop.mileage), [0, 239, 406])
  assert.deepEqual(await queryLcrTimetable('C85', '2026-11-13', load), [])
  assert.deepEqual(await queryLcrTimetable('D85', date, load), [])
})

test('万象每日更新合并并发请求，失败保留已下载的班次并在 15 分钟后重试', async () => {
  let calls = 0
  let now = Date.parse('2026-11-10T23:10:00Z')
  const load = createLcrTimetableLoader(async () => {
    calls++
    if (calls === 2) throw new Error('network')
    return response(calls === 1 ? feed() : feed('2026-11-11T23:00:07Z', []))
  }, () => now)
  const [first, second] = await Promise.all([load(), load()])
  assert.equal(first, second)
  assert.equal(calls, 1)
  now = Date.parse('2026-11-11T23:04:59Z')
  assert.equal(await load(), first)
  assert.equal(calls, 1)
  now += 1000
  assert.equal(await load(), first)
  assert.equal(await load(), first)
  assert.equal(calls, 2)
  now += 15 * 60 * 1000
  assert.equal((await load()).trains.size, 0)
  assert.equal(calls, 3)
})

test('C85 和 C86 优先显示昆明与香格里拉之间的班次，国内班次移除后显示老挝班次', async () => {
  const loadLcr = createLcrTimetableLoader(async () => response(feed(undefined, [trip, { ...trip, train: 'C86' }])))
  const loadDatabase = async () => ({ trains: new Map() })
  for (const [train, from, to] of [['C85', '香格里拉', '昆明'], ['C86', '昆明', '香格里拉']]) {
    const fetchDomestic = async url => response(url.includes('/search/v1/') ? {
      data: [{ station_train_code: train, train_no: train, from_station: from, to_station: to }],
    } : {
      data: { data: [{ station_name: from, start_time: '09:00' }, { station_name: to, arrive_time: '14:00' }] },
    })
    const result = await queryTrainInfo(train, date, fetchDomestic, loadDatabase, loadLcr)
    assert.equal(result.from, from)
    assert.equal(result.source, '12306')
    assert.equal(result.alternatives[0].from, '万象')
    assert.equal((await queryTrainInfo(train, '2026-11-12', fetchDomestic, loadDatabase, loadLcr)).source, '12306')

    const withoutDomestic = await queryTrainInfo(train, date, async () => response({ data: [] }), loadDatabase, loadLcr)
    assert.equal(withoutDomestic.from, '万象')
    assert.equal(withoutDomestic.alternatives, undefined)
  }
})
