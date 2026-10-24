import test from 'node:test'
import assert from 'node:assert/strict'

process.env.DATABASE_PATH = ':memory:'
const { default: app } = await import('../app.js')
const { default: db } = await import('../db/db.js')

test('历史导入保留创建时间、忽略备份身份和设置，满额重复导入与超额回滚', async t => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(async () => {
    await new Promise(resolve => server.close(resolve))
    db.close()
  })
  const base = `http://127.0.0.1:${server.address().port}/api`
  let cookie
  async function post(path, body) {
    const response = await fetch(base + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'X-CRTicket-Request': '1',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    })
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie')
    return { status: response.status, data: await response.json() }
  }
  const credentials = { username: 'history-owner', password: 'BackupPass123' }
  await post('/user/register', credentials)
  const user = (await post('/user/login', credentials)).data.user
  const record = {
    ticket_number: 'ZERO', train_no: 'V1', price: 0, distance: 0,
    use_credit: 1, has_conditioner: 0, created_at: '2026-01-02T03:04:05.000Z',
    id: 'android-id', user_id: 'device',
  }
  const backup = {
    schemaVersion: 2, app: 'CRTicket', contents: ['tickets', 'profile', 'settings'],
    user: { username: 'Android user' },
    settings: { profile: { username: 'Android user' }, native: { arrivalEnabled: true } },
    tickets: [record, record, { ...record, price: 'bad' }, null],
  }
  const imported = await post('/user/import-backup', { backup })
  assert.deepEqual(imported.data.data, { imported: 1, skipped: 1, invalid: 2, total: 4 })
  const saved = db.prepare('SELECT * FROM tickets WHERE user_id = ?').get(user.id)
  assert.equal(saved.created_at, record.created_at)
  assert.equal(saved.price, 0)
  assert.equal(saved.user_id, user.id)
  assert.equal(db.prepare('SELECT username FROM users WHERE id = ?').get(user.id).username,
    credentials.username)
  const fill = db.transaction(() => {
    const insert = db.prepare('INSERT INTO tickets (user_id, ticket_number) VALUES (?, ?)')
    for (let i = 0; i < 9998; i++) insert.run(user.id, `FILL-${i}`)
  })
  fill()
  const overflow = await post('/user/import-backup', { backup: [
    { ...record, ticket_number: 'NEW1' }, { ...record, ticket_number: 'NEW2' },
  ] })
  assert.equal(overflow.status, 409)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count, 9999)
  assert.equal((await post('/user/import-backup', {
    backup: [{ ...record, ticket_number: 'LAST' }],
  })).data.data.imported, 1)
  assert.equal((await post('/user/import-backup', { backup: [record] })).data.data.skipped, 1)
  const settingsOnly = await post('/user/import-backup', {
    backup: { ...backup, contents: ['settings'], tickets: [record] },
  })
  assert.equal(settingsOnly.data.success, false)
})
