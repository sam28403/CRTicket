import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasTrainTimeZoneOptions, trainStopsInTimeZone } from './trainTimeZoneDisplay.js'

test('时区选项只匹配指定车次，支持组合车次和离线方案', () => {
  for (const train of ['D83', 'D84/85', 'D86/D83B', 'd87', 'D88', 'Y25/Y28', 'Y26', 'Y27B', 'Y28']) {
    assert.equal(hasTrainTimeZoneOptions(train), true, train)
  }
  for (const train of [undefined, 'D82', 'D830', 'G85', 'Y24', 'Y280']) {
    assert.equal(hasTrainTimeZoneOptions(train), false, train)
  }
})

test('跨境列车在两个方向都按口岸站序换算，保留原始时刻和停留时长', () => {
  const stops = Object.freeze([
    Object.freeze({ station: '万象', departure: '12:25' }),
    Object.freeze({ station: '老挝境内新增站', arrival: '13:17' }),
    Object.freeze({ station: '磨丁', arrival: '15:31', departure: '16:25', stay: 54 }),
    Object.freeze({ station: '磨憨', arrival: '16:37', departure: '17:29', stay: 52 }),
  ])
  assert.deepEqual(trainStopsInTimeZone(stops, 'local').map(stop => stop.arrival), [
    undefined, '12:17', '14:31', '16:37',
  ])
  const reverse = [...stops].reverse()
  assert.deepEqual(trainStopsInTimeZone(reverse, 'local').map(stop => stop.departure), [
    '17:29', '15:25', undefined, '11:25',
  ])
  assert.equal(trainStopsInTimeZone(stops, 'vientiane')[3].arrival, '15:37')
  assert.equal(trainStopsInTimeZone(stops, 'local')[2].stay, 54)
  assert.deepEqual(trainStopsInTimeZone(stops, 'beijing'), stops)
})

test('旅游专列按实际站点处理全中国和全老挝线路，并保留换算后的日期', () => {
  const china = [{ station: '西双版纳', departure: '21:09' }, { station: '昆明', arrival: '08:41', arrivalDay: 1 }]
  assert.deepEqual(trainStopsInTimeZone(china, 'local'), china)
  assert.equal(trainStopsInTimeZone(china, 'vientiane')[1].arrival, '07:41')

  const laos = [
    { station: '万象', departure: '00:15', arrivalDay: 0 },
    { station: '万荣', arrival: '00:50', departure: '01:02', arrivalDay: 0 },
    { station: '琅勃拉邦', arrival: '00:20', arrivalDay: 1 },
  ]
  const local = trainStopsInTimeZone(laos, 'local')
  assert.deepEqual(local.map(stop => [stop.arrival, stop.arrivalDay]), [
    [undefined, 0], ['23:50', -1], ['23:20', 0],
  ])
  assert.deepEqual(local.map(stop => [stop.departure, stop.departureDay]), [
    ['23:15', -1], ['00:02', 0], [undefined, 1],
  ])
  assert.deepEqual(trainStopsInTimeZone(laos, 'vientiane'), local)
})

test('老中铁路时刻以万象为基准，切换到北京时加一小时并更新跨日数', () => {
  const stops = [{ station: '万象', departure: '23:35', departureDay: 0 }]
  assert.equal(trainStopsInTimeZone(stops, 'vientiane', 'vientiane'), stops)
  const [stop] = trainStopsInTimeZone(stops, 'beijing', 'vientiane')
  assert.equal(stop.departure, '00:35')
  assert.equal(stop.departureDay, 1)
})
