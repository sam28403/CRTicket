import test from 'node:test'
import assert from 'node:assert/strict'
import { stationBoardColumns, stationBoardRows, stationClock } from './stationBoard.js'
import { currentTrainIndex } from './stationBoardTime.js'

test('系统时钟固定北京时间，在午夜切换当天日期', () => {
  assert.deepEqual(stationClock(Date.parse('2026-10-11T15:59:59Z')), {
    date: '2026-10-11', time: '23:59:59', minutes: 1439, seconds: 86399,
  })
  assert.deepEqual(stationClock(Date.parse('2026-10-11T16:00:00Z')), {
    date: '2026-10-12', time: '00:00:00', minutes: 0, seconds: 0,
  })
})

test('三个标签使用本站时间排序，始发终到及跨日事件分别筛选', () => {
  const trains = [
    { train: 'G1', arrival: null, departure: '09:00', departureStatus: '正点' },
    { train: 'K2', arrival: '01:00', departure: '01:05' },
    { train: 'K3', arrival: '23:55', departure: null, arrivalStatus: '晚点 5 分钟' },
  ]
  assert.deepEqual(stationBoardRows(trains, 'all').map(row => row.train), ['K2', 'G1', 'K3'])
  assert.deepEqual(stationBoardRows(trains, 'departure').map(row => row.train), ['K2', 'G1'])
  const arrivals = stationBoardRows(trains, 'arrival')
  assert.deepEqual(arrivals.map(row => row.train), ['K2', 'K3'])
  assert.equal(arrivals[1].status, '晚点 5 分钟')
  assert.equal(trains[0].timeSeconds, undefined)
})

test('可选列按当前标签实际提供的数据展示，缺失字段不默认正点', () => {
  const base = [{ train: 'G1', arrival: null, departure: '09:00' }]
  assert.deepEqual(stationBoardColumns(stationBoardRows(base, 'all'), 'all').map(column => column.title), [
    '车次', '始发站', '终到站', '到达时间', '开车时间', '停留时间',
  ])
  const rows = stationBoardRows([{ ...base[0], ticketGate: 'A1', departureStatus: '正点' }], 'departure')
  assert.deepEqual(stationBoardColumns(rows, 'departure').map(column => column.title), [
    '车次', '终到站', '开车时间', '检票口', '正晚点',
  ])
  const arrivals = stationBoardRows([{ train: 'K1', arrival: '10:00', exit: '北出口', arrivalStatus: '晚点' }], 'arrival')
  assert.deepEqual(stationBoardColumns(arrivals, 'arrival').map(column => column.title), [
    '车次', '始发站', '到达时间', '出站口', '正晚点',
  ])
})

test('1200 趟车次按当前时间定位，兼容全天结束和空列表', () => {
  const rows = Array.from({ length: 1200 }, (_, index) => ({ timeSeconds: (index + 1) * 60 }))
  assert.equal(currentTrainIndex(rows, 720 * 60), 720)
  assert.equal(currentTrainIndex(rows, 720 * 60 + 30), 720)
  assert.equal(currentTrainIndex(rows, 0), 0)
  assert.equal(currentTrainIndex(rows, 1200 * 60), -1)
  assert.equal(currentTrainIndex(rows, 1439 * 60), -1)
  assert.equal(currentTrainIndex([], 720 * 60), -1)
})
