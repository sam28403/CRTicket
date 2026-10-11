import test from 'node:test'
import assert from 'node:assert/strict'
import { stationBoardRows } from './stationBoard.js'
import { currentTrainHighlights } from './stationBoardTime.js'

const fastTrains = ['G123', 'D123', 'C123', 'S123', 'G123AB']
const regularTrains = ['Z123', 'K123', 'T123', 'Y123', '4181/4184', '1234AA']
const tenOClock = 10 * 3600

function colors(trains, seconds, tab = 'all') {
  const rows = stationBoardRows(trains, tab)
  const result = currentTrainHighlights(rows, seconds)
  const names = indexes => [...indexes].map(index => rows[index].train).sort()
  return { green: names(result.upcoming), amber: names(result.inStation) }
}

test('始发车按类别提前 20 或 30 分钟绿色高亮，开车当秒结束', () => {
  for (const [codes, leadMinutes] of [[fastTrains, 20], [regularTrains, 30]]) {
    for (const train of codes) {
      const rows = [{ train, arrival: null, arrivalLabel: '始发站', departure: '10:00' }]
      for (const tab of ['all', 'departure']) {
        assert.deepEqual(colors(rows, tenOClock - leadMinutes * 60 - 1, tab), {
          green: [], amber: [],
        }, train)
        assert.deepEqual(colors(rows, tenOClock - leadMinutes * 60, tab), {
          green: [train], amber: [],
        }, train)
        assert.deepEqual(colors(rows, tenOClock - 1, tab), { green: [train], amber: [] }, train)
        assert.deepEqual(colors(rows, tenOClock, tab), { green: [], amber: [] }, train)
      }
    }
  }
})

test('途经车均提前 15 分钟绿色高亮，到站当秒切换琥珀色，开车当秒结束', () => {
  for (const train of [...fastTrains, ...regularTrains]) {
    const rows = [{ train, arrival: '09:58', departure: '10:00' }]
    for (const tab of ['all', 'departure', 'arrival']) {
      assert.deepEqual(colors(rows, tenOClock - 15 * 60 - 1, tab), { green: [], amber: [] })
      assert.deepEqual(colors(rows, tenOClock - 15 * 60, tab), { green: [train], amber: [] })
      assert.deepEqual(colors(rows, tenOClock - 2 * 60, tab), { green: [], amber: [train] })
      assert.deepEqual(colors(rows, tenOClock - 1, tab), { green: [], amber: [train] })
      assert.deepEqual(colors(rows, tenOClock, tab), { green: [], amber: [] })
    }
  }
})

test('终到前 10 分钟绿色高亮，到达当秒结束，不无限高亮终到列车', () => {
  for (const train of [...fastTrains, ...regularTrains]) {
    const rows = [{ train, arrival: '10:00', departure: null, departureLabel: '终到站' }]
    for (const tab of ['all', 'arrival']) {
      assert.deepEqual(colors(rows, tenOClock - 10 * 60 - 1, tab), { green: [], amber: [] })
      assert.deepEqual(colors(rows, tenOClock - 10 * 60, tab), { green: [train], amber: [] })
      assert.deepEqual(colors(rows, tenOClock - 1, tab), { green: [train], amber: [] })
      assert.deepEqual(colors(rows, tenOClock, tab), { green: [], amber: [] })
    }
  }
})

test('站内停靠优先琥珀色，多车同时高亮；范围外的下一趟车不高亮', () => {
  const rows = [
    { train: 'G1', arrival: '09:40', departure: '10:00' },
    { train: 'K2', arrival: '09:50', departure: '10:00' },
    { train: 'D3', arrival: null, departure: '10:05' },
    { train: 'C4', arrival: null, departure: '12:00' },
  ]
  assert.deepEqual(colors(rows, tenOClock - 10 * 60), { green: ['D3'], amber: ['G1', 'K2'] })
  assert.deepEqual(colors(rows, tenOClock), { green: ['D3'], amber: [] })
  assert.deepEqual(colors(rows, tenOClock + 5 * 60), { green: [], amber: [] })
  assert.deepEqual(colors(rows, 23 * 3600), { green: [], amber: [] })
})

test('跨午夜途经车使用相对当日的到发时间，不能误判为始发或终到', () => {
  const yesterday = [{
    train: 'K1', arrival: null, arrivalLabel: '昨日 23:55', departure: '00:10',
  }]
  assert.deepEqual(colors(yesterday, 0), { green: [], amber: ['K1'] })
  assert.deepEqual(colors(yesterday, 10 * 60), { green: [], amber: [] })
  const tomorrow = [{
    train: 'G2', arrival: '23:58', departure: null, departureLabel: '次日 00:10',
  }]
  assert.deepEqual(colors(tomorrow, 23 * 3600 + 54 * 60 + 59), { green: [], amber: [] })
  assert.deepEqual(colors(tomorrow, 23 * 3600 + 55 * 60), { green: ['G2'], amber: [] })
  assert.deepEqual(colors(tomorrow, 23 * 3600 + 58 * 60), { green: [], amber: ['G2'] })
})

test('未指定类别不套用绿色窗口，但已在站内仍为琥珀色', () => {
  const rows = [{ train: 'L1', arrival: '09:58', departure: '10:00' }]
  assert.deepEqual(colors(rows, tenOClock - 5 * 60), { green: [], amber: [] })
  assert.deepEqual(colors(rows, tenOClock - 1), { green: [], amber: ['L1'] })
  assert.deepEqual(colors([], tenOClock), { green: [], amber: [] })
})
