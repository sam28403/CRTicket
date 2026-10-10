import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import Database from 'better-sqlite3'
import { attachSession } from '../auth.js'
import { createTicketBatchHandler } from './ticketBatch.js'
import { TICKET_FIELDS } from '../../src/utils/ticketFields.js'

test('批量保存校验登录、数量、用户归属、配额及事务回滚，使用独立内存数据库', async () => {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE tickets (id INTEGER PRIMARY KEY, user_id INTEGER,
    ${TICKET_FIELDS.map(field => field === 'price' ? 'price REAL CHECK(price != 13)' : field).join(', ')})`)
  const app = express()
  app.use(express.json())
  app.get('/session', (req, res) => {
    attachSession(res, { id: 1, username: 'test' })
    res.json({ success: true })
  })
  app.post('/batch', createTicketBatchHandler(db))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const cookie = (await fetch(`${base}/session`)).headers.get('set-cookie').split(';')[0]
    const request = async (tickets, loggedIn = true) => fetch(`${base}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(loggedIn ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ tickets }),
    })
    assert.equal((await request([{}], false)).status, 401)
    for (const invalid of [[], null, Array(1001).fill({}), [{ price: -1 }]]) {
      assert.equal((await request(invalid)).status, 400)
    }
    assert.equal((await request([{ user_id: 999, train_no: 'G1', price: 525 }, { price: 7 }])).status, 200)
    assert.deepEqual(db.prepare('SELECT DISTINCT user_id FROM tickets').all(), [{ user_id: 1 }])
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n, 2)
    assert.equal((await request([{ price: 1 }, { price: 13 }])).status, 500)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n, 2)
    db.exec(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<9997)
      INSERT INTO tickets (user_id) SELECT 1 FROM n`)
    assert.equal((await request([{}, {}])).status, 409)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n, 9999)
  } finally {
    await new Promise(resolve => server.close(resolve))
    db.close()
  }
})
