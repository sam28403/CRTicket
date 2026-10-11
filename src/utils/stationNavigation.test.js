import test from 'node:test'
import assert from 'node:assert/strict'
import { stationLocation, stationTrainLocation } from './stationNavigation.js'

test('车站跳转清除站名空白，仅查询目标站当天的大屏', () => {
  assert.deepEqual(stationLocation(' 上海虹桥 '), {
    path: '/station', query: { station: '上海虹桥' },
  })
  assert.deepEqual(stationLocation('北 京南').query, { station: '北京南' })
})

test('离线双车次及方案后缀使用完整记录号，并保留跨日列车始发日期', () => {
  assert.deepEqual(stationTrainLocation({
    train: 'G1/G2B', trainDate: '2026-10-10',
  }, '路路通', '2026-10-11'), {
    path: '/train', query: { train: 'G1/G2B', date: '2026-10-10', source: 'llt' },
  })
})

test('在线双车次使用可查询的单车次，缺少始发日期时使用查询日期', () => {
  assert.deepEqual(stationTrainLocation({ train: 'G1/G2' }, '12306', '2026-10-11'), {
    path: '/train', query: { train: 'G1', date: '2026-10-11' },
  })
})
