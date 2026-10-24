import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBackupPayload,
  importTicketBackup,
  normalizeBackupTicket,
  parseTicketBackup,
} from './ticketBackup.js'

const ticket = {
  ticket_number: 'E0001', train_no: 'N12', departure_station: '北京',
  arrival_station: '上海', travel_date: '2026年10月24日', departure_time: '08:00',
  price: 0, use_credit: true, seat_type: '硬卧', has_conditioner: false,
  seat_no: '03车12号', sell_place: '', gate_info: '', message: '第一行\n第二行',
  theme: 'Red.jpg', distance: 1234.5, created_at: '2026-10-01T02:03:04.000Z',
}

test('历史备份只导出车票，保留零票价、创建时间，不复制身份或其他内容', () => {
  const backup = buildBackupPayload([{ ...ticket, id: 'android-id', user_id: 'device',
    settings: { theme: 'contrast-dark' }, avatar: 'private' }])
  assert.equal(backup.schemaVersion, 2)
  assert.deepEqual(backup.contents, ['tickets'])
  assert.deepEqual(backup.settings, {})
  assert.equal(backup.user, undefined)
  assert.equal(backup.tickets[0].created_at, ticket.created_at)
  assert.equal(backup.tickets[0].price, 0)
  assert.equal(backup.tickets[0].use_credit, 1)
  for (const key of ['id', 'user_id', 'settings', 'avatar']) {
    assert.equal(Object.hasOwn(backup.tickets[0], key), false)
  }
})

test('兼容旧版数组、版本1及Android完整备份，仅提取tickets并拒绝未选择历史的文件', () => {
  for (const payload of [[ticket], { schemaVersion: 1, tickets: [ticket] },
    { schemaVersion: 2, app: 'CRTicket', tickets: [ticket],
      contents: ['tickets', 'profile'], settings: { profile: 'ignored' } }]) {
    assert.deepEqual(parseTicketBackup('\uFEFF' + JSON.stringify(payload)), [ticket])
  }
  assert.throws(() => parseTicketBackup({ schemaVersion: 3, tickets: [] }), /版本/)
  assert.throws(() => parseTicketBackup({ contents: ['settings'], tickets: [] }), /没有车票/)
  assert.throws(() => parseTicketBackup({ tickets: 'invalid' }), /没有找到/)
  assert.throws(() => parseTicketBackup(Array(10001).fill(ticket)), /10000/)
})

test('统一兼容字段别名，拒绝非法数字和嵌套字段，防止静默转换为有效车票', () => {
  const normalized = normalizeBackupTicket({ number: 'A1', trainNo: 'V1',
    departureStation: '北京', arrivalStation: '上海', useCredit: true,
    hasConditioner: false, gateInfo: 'A1', created_at: 'invalid' })
  assert.equal(normalized.train_no, 'V1')
  assert.equal(normalized.use_credit, 1)
  assert.equal(normalized.gate_info, 'A1')
  assert.equal(normalized.created_at, undefined)
  for (const raw of [null, [], { price: 'abc' }, { price: {} }, { distance: -1 },
    { use_credit: 2 }, { train_no: {} }, { train_no: 'G'.repeat(201) }]) {
    assert.equal(normalizeBackupTicket(raw), null)
  }
})

test('历史导入接受零票价，按字段去重，分批请求只发送车票数据', async () => {
  const batches = []
  const api = { post: async (path, body) => {
    assert.equal(path, '/user/import-backup')
    assert.deepEqual(Object.keys(body), ['backup'])
    batches.push(body.backup)
    return { data: { success: true,
      data: { imported: body.backup.length, skipped: 0, invalid: 0 } } }
  } }
  const records = Array.from({ length: 101 }, (_, i) => ({ ...ticket, ticket_number: `E${i}` }))
  const counts = await importTicketBackup([
    ...records, records[0], { ...records[1], price: '0' }, null, { ...ticket, price: 'bad' },
  ], [], api)
  assert.deepEqual(counts, { imported: 101, skipped: 2, invalid: 2 })
  assert.deepEqual(batches.map(batch => batch.length), [100, 1])
  assert.equal(batches[0][0].created_at, ticket.created_at)
  assert.deepEqual(await importTicketBackup(records, records, api), {
    imported: 0, skipped: 101, invalid: 0,
  })
})
