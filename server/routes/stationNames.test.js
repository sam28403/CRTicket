import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createStationRouter } from './station.js'
import { parseStations } from '../../src/utils/stations.js'

test('HTTP 接受推荐列表外站名，分别查询与缓存，空结果也按站名隔离', async () => {
  const names = ['列表外甲站', '列表外乙站']
  assert.ok(names.every(name => !parseStations().some(station => station.name === name)))
  const database = {
    version: '20261011',
    trains: new Map(names.map((name, index) => [`G${index + 1}`, {
      train: `G${index + 1}`,
      schedule: { startDate: '2026-10-01', endDate: '2026-10-31', rule: null },
      stops: [
        { station: name, departure: '08:00', departureDay: 0 },
        { station: '终点站', arrival: '09:00', arrivalDay: 0 },
      ],
    }])),
  }
  const calls = []
  const app = express()
  app.use('/station', createStationRouter({
    now: () => Date.parse('2026-10-11T12:00:00+08:00'),
    queryOnline: async station => { calls.push(station); return [] },
    loadDatabase: async () => database,
  }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    const query = async name => {
      const params = new URLSearchParams({ station: name })
      const response = await fetch(`${base}/station?${params}`)
      assert.equal(response.status, 200)
      return response.json()
    }
    const [left, right] = await Promise.all(names.map(query))
    assert.equal(left.station, names[0])
    assert.equal(left.trains[0].train, 'G1')
    assert.equal(right.station, names[1])
    assert.equal(right.trains[0].train, 'G2')
    assert.equal(right.source, '路路通')
    assert.deepEqual(await query(` ${names[0]} `), left)
    assert.equal(calls.length, 2)
    assert.ok(calls.every(station => station.telecode === ''))
    const empty = await query('不存在的站')
    assert.equal(empty.station, '不存在的站')
    assert.equal(empty.total, 0)
    assert.deepEqual(empty.trains, [])
    assert.equal((await query(names[1])).trains[0].train, 'G2')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
