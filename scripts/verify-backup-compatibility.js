import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { TICKET_FIELDS } from '../src/utils/ticketFields.js'
import {
  buildBackupPayload, importTicketBackup, parseTicketBackup,
} from '../src/utils/ticketBackup.js'

const androidRoot = process.argv[2]
if (!androidRoot) throw new Error('请传入 Android 项目目录')
const androidModule = file => import(pathToFileURL(resolve(androidRoot, 'web/src', file)))
const { buildAppBackup, parseAppBackup } = await androidModule('utils/appBackup.js')
const { restoreDeviceBackup } = await androidModule('android/deviceBackup.js')
const { createLocalApi } = await androidModule('android/localApi.js')

// 使用独立内存数据库与本机存储夹具，不访问两个项目的真实用户数据。
process.env.DATABASE_PATH = ':memory:'
const { default: app } = await import('../server/app.js')
const { default: db } = await import('../server/db/db.js')
const server = app.listen(0, '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}/api`
let cookie
async function request(path, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json', 'X-CRTicket-Request': '1',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json()
  assert.equal(response.status, 200, JSON.stringify(data))
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie')
  return { data }
}
const values = new Map()
const storage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
}
const ticket = {
  ticket_number: 'E-MIGRATION', train_no: 'N12/V13', departure_station: '北京',
  arrival_station: '上海', travel_date: '2026年10月24日', departure_time: '08:00',
  price: 0, use_credit: 1, seat_type: '硬卧', has_conditioner: 0,
  seat_no: '03车12号', sell_place: null, gate_info: null,
  message: '历史记录互通\n第二行', theme: 'Red.jpg', distance: 1234.5,
  created_at: '2026-01-02T03:04:05.000Z',
}
const options = {
  storage,
  validateNative: () => { throw new Error('历史导入不能恢复原生设置') },
  restoreNative: async () => { throw new Error('历史导入不能恢复原生设置') },
  applyTheme: () => { throw new Error('历史导入不能恢复主题') },
  updateUser: () => { throw new Error('历史导入不能恢复用户资料') },
}
const snapshot = records => records.map(record => Object.fromEntries(
  [...TICKET_FIELDS, 'created_at'].map(field => [field, record[field]]),
)).sort((a, b) => a.ticket_number.localeCompare(b.ticket_number))

try {
  const credentials = { username: 'backup-test', password: 'BackupPass123' }
  assert.equal((await request('/user/register', credentials)).data.success, true)
  const user = (await request('/user/login', credentials)).data.user
  const records = [ticket, { ...ticket, ticket_number: 'E-PAID', price: 25.5, use_credit: 0 }]

  // 网页导出 -> Android 的实际完整备份解析与恢复入口。
  const webExport = buildBackupPayload(records)
  const parsed = parseAppBackup(JSON.stringify(webExport))
  assert.deepEqual(await restoreDeviceBackup(parsed, options), {
    imported: 2, skipped: 0, invalid: 0,
  })
  const device = createLocalApi(storage)
  const androidRecords = await device.request('GET', '/ticket/list/device')
  assert.deepEqual(snapshot(androidRecords), snapshot(records))
  assert.deepEqual(await restoreDeviceBackup(parsed, options), {
    imported: 0, skipped: 2, invalid: 0,
  })
  assert.equal(storage.getItem('crticket-device-owner-v1'), null)

  // Android 真实导出器生成完整备份，网页只提取历史，其余内容全部忽略。
  const androidExport = buildAppBackup(androidRecords, {
    id: 'device', username: 'Android 用户', avatar: null,
  }, { theme: 'contrast-dark', storage, native: { language: 'en', arrivalEnabled: true } })
  const counts = await importTicketBackup(
    parseTicketBackup(JSON.stringify(androidExport)), [], { post: request },
  )
  assert.deepEqual(counts, { imported: 2, skipped: 0, invalid: 0 })
  const webRecords = (await request(`/ticket/list/${user.id}`)).data
  assert.deepEqual(snapshot(webRecords), snapshot(records))
  assert.ok(webRecords.every(record => record.user_id === user.id))
  const profile = (await request('/user/session')).data.user
  assert.equal(profile.username, credentials.username)
  assert.equal(profile.avatar, null)
  assert.deepEqual(await importTicketBackup(
    parseTicketBackup(androidExport), webRecords, { post: request },
  ), { imported: 0, skipped: 2, invalid: 0 })

  // 再次网页导出 -> Android，保持字段和创建时间，且不制造重复历史。
  const roundTrip = parseAppBackup(JSON.stringify(buildBackupPayload(webRecords)))
  assert.deepEqual(await restoreDeviceBackup(roundTrip, options), {
    imported: 0, skipped: 2, invalid: 0,
  })
  assert.deepEqual(snapshot(await device.request('GET', '/ticket/list/device')), snapshot(records))
  console.log('PASS: 网页与 Android 真实备份代码双向往返、零票价、创建时间、去重、身份隔离及非历史数据排除')
} finally {
  await new Promise(resolve => server.close(resolve))
  db.close()
}
