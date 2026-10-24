import { TICKET_FIELDS, comparableTicketValues } from './ticketFields.js'

const numericFields = new Set(['price', 'distance', 'use_credit', 'has_conditioner'])
const flags = new Set(['use_credit', 'has_conditioner'])
const aliases = {
  ticket_number: ['number'],
  train_no: ['trainNo'],
  departure_station: ['departureStation', 'from'],
  arrival_station: ['arrivalStation', 'to'],
  travel_date: ['travelDate', 'date'],
  departure_time: ['departureTime', 'time'],
  use_credit: ['useCredit'],
  seat_type: ['seatType'],
  has_conditioner: ['hasConditioner'],
  seat_no: ['seatNo'],
  sell_place: ['sellPlace'],
  gate_info: ['gateInfo', 'gate'],
}

export function normalizeBackupTicket(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const ticket = {}
  for (const field of TICKET_FIELDS) {
    const key = [field, ...(aliases[field] || [])].find(name => raw[name] != null)
    const value = key === undefined ? undefined : raw[key]
    if (numericFields.has(field)) {
      const number = value == null || value === ''
        ? (field === 'price' ? null : 0) : Number(value)
      if (value != null && !['number', 'string', 'boolean'].includes(typeof value)) return null
      if (number != null && (!Number.isFinite(number) || number < 0 || number > 10000000)) return null
      if (flags.has(field) && ![0, 1].includes(number)) return null
      ticket[field] = number
    } else {
      if (value != null && (typeof value !== 'string'
          || value.length > (field === 'message' ? 2000 : 200))) return null
      ticket[field] = value == null || value === '' ? null : value
    }
  }
  if (typeof raw.created_at === 'string' && raw.created_at.length <= 40
      && Number.isFinite(Date.parse(raw.created_at))) {
    ticket.created_at = raw.created_at
  }
  return ticket
}

export function parseTicketBackup(text, limit = 10000) {
  const value = typeof text === 'string' ? JSON.parse(text.replace(/^\uFEFF/, '')) : text
  if (!Array.isArray(value)) {
    if (value?.schemaVersion !== undefined && ![1, 2].includes(value.schemaVersion)) {
      throw new Error('不支持此备份版本')
    }
    if (value?.app !== undefined && value.app !== 'CRTicket') {
      throw new Error('不支持此备份格式')
    }
    if (value?.contents !== undefined
        && (!Array.isArray(value.contents) || !value.contents.includes('tickets'))) {
      throw new Error('备份文件中没有车票历史记录')
    }
  }
  const tickets = Array.isArray(value) ? value : value?.tickets
  if (!Array.isArray(tickets)) throw new Error('备份文件中没有找到车票数据')
  if (tickets.length > limit) throw new Error(`一次最多导入 ${limit} 条车票记录`)
  return tickets
}

export function buildBackupPayload(tickets) {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    app: 'CRTicket',
    contents: ['tickets'],
    settings: {},
    tickets: tickets.map(ticket => {
      const normalized = normalizeBackupTicket(ticket)
      if (!normalized) throw new Error('存在格式无效的车票记录，无法导出')
      return normalized
    }),
  }
}

export const backupTicketFingerprint = ticket => JSON.stringify(
  comparableTicketValues(normalizeBackupTicket(ticket) || ticket),
)

export async function importTicketBackup(tickets, currentTickets, api) {
  const existing = new Set(currentTickets.map(backupTicketFingerprint))
  const pending = []
  const counts = { imported: 0, skipped: 0, invalid: 0 }
  const required = [
    'ticket_number', 'train_no', 'departure_station', 'arrival_station',
    'travel_date', 'departure_time', 'seat_type', 'seat_no',
  ]
  for (const raw of tickets) {
    const ticket = normalizeBackupTicket(raw)
    if (!ticket || required.some(field => !ticket[field]) || ticket.price == null) {
      counts.invalid++
      continue
    }
    const fingerprint = backupTicketFingerprint(ticket)
    if (existing.has(fingerprint)) {
      counts.skipped++
      continue
    }
    pending.push(ticket)
    existing.add(fingerprint)
  }
  for (let offset = 0; offset < pending.length; offset += 100) {
    const { data } = await api.post('/user/import-backup', {
      backup: pending.slice(offset, offset + 100),
    })
    if (!data.success) throw new Error(data.message || '导入失败')
    for (const field of Object.keys(counts)) counts[field] += data.data[field]
  }
  return counts
}
