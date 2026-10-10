import { validTicket, ticketQuota } from './ticketValidation.js'
import { INSERT_TICKET_SQL } from '../db/ticketQueries.js'
import { ticketFieldValues } from '../../src/utils/ticketFields.js'
import { requireSession } from '../auth.js'

export function createTicketBatchHandler(db) {
  const insertBatch = db.transaction((userId, tickets) => {
    const count = db.prepare('SELECT COUNT(*) AS count FROM tickets WHERE user_id = ?')
      .get(userId).count
    if (count + tickets.length > ticketQuota) return false
    const insert = db.prepare(INSERT_TICKET_SQL)
    for (const ticket of tickets) insert.run(userId, ...ticketFieldValues(ticket))
    return true
  })
  return (req, res) => {
    const user = requireSession(req, res)
    if (!user) return
    const tickets = req.body?.tickets
    if (!Array.isArray(tickets) || tickets.length < 1 || tickets.length > 1000
      || tickets.some(ticket => !validTicket(ticket))) {
      return res.status(400).json({ success: false, message: '请提交 1 至 1000 张格式正确的车票' })
    }
    try {
      if (!insertBatch(user.userId, tickets)) {
        return res.status(409).json({ success: false, message: '本批车票超过账号的 10000 条上限，未保存' })
      }
      res.json({ success: true, count: tickets.length, message: '本批车票已全部保存' })
    } catch {
      res.status(500).json({ success: false, message: '批量保存失败，本批车票未保存' })
    }
  }
}
