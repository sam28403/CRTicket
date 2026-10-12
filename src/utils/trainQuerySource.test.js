import test from 'node:test'
import assert from 'node:assert/strict'
import { trainQuerySourceLocation } from './trainQuerySource.js'
import { trainQueryRange } from './trainQueryDate.js'

const date = trainQueryRange().today

test('切换离线来源保留车次和日期，并设置路路通参数', () => {
  assert.deepEqual(trainQuerySourceLocation({ train: ' d7976 ', date, offline: true }), {
    path: '/train',
    query: { train: 'D7976', date, source: 'llt' },
  })
})

test('离线双车次切换在线时使用单车次，并可切回完整离线记录', () => {
  const offlineRecord = 'G1/G2B'
  const online = trainQuerySourceLocation({ train: 'G1/G2', date, offline: false })
  assert.deepEqual(online.query, { train: 'G1', date, source: undefined })
  const offline = trainQuerySourceLocation({
    train: online.query.train, date, offline: true, offlineRecord,
  })
  assert.equal(offline.query.train, offlineRecord)
  assert.equal(offline.query.source, 'llt')
})

test('输入新车次后切换离线不会套用旧记录', () => {
  const location = trainQuerySourceLocation({
    train: 'G3', date, offline: true, offlineRecord: 'G1/G2B',
  })
  assert.equal(location.query.train, 'G3')
})

test('在线来源将范围外日期改为今天，离线来源保留原日期', () => {
  const options = { train: 'D7976', date: '2000-01-01' }
  assert.equal(trainQuerySourceLocation({ ...options, offline: false }).query.date, date)
  assert.equal(trainQuerySourceLocation({ ...options, offline: true }).query.date, options.date)
})

test('尚未输入车次也可以切换来源', () => {
  assert.deepEqual(trainQuerySourceLocation({ train: '', date, offline: true }).query, {
    train: undefined, date, source: 'llt',
  })
})
