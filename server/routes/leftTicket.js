import express from 'express'
import stationData from '../../src/station_name.js'
import { rateLimit } from '../security.js'
import { parseSeats } from './leftTicketSeats.js'
import { queryLeftTicketData } from './leftTicketClient.js'

const stationCodes = new Set(stationData.split('@').filter(Boolean).map(row => row.split('|')[2]))

// 字段顺序来自官方 queryLeftTicket_end_js.js 的 cN 转换函数（2026-09-21）。
export function parseTrains(data) {
  if (!data || !Array.isArray(data.result) || !data.map || typeof data.map !== 'object') {
    throw new Error('12306 返回的数据格式已变化，请稍后重试')
  }
  return data.result.map(row => {
    if (typeof row !== 'string') throw new Error('12306 返回了无法识别的车次数据')
    const fields = row.split('|')
    if (fields.length < 33 || !fields[2] || !fields[3]) throw new Error('12306 返回的车次字段不完整')
    return {
      id: `${fields[2]}-${fields[6]}-${fields[7]}`, train: fields[3],
      from: data.map[fields[6]] || fields[6], to: data.map[fields[7]] || fields[7],
      departure: fields[8], arrival: fields[9], duration: fields[10],
      canBuy: fields[11] === 'Y', status: fields[1].replace(/<[^>]*>/g, ''),
      seats: parseSeats(fields),
    }
  })
}

export function validateQuery(query) {
  const { from, to, date } = query
  if (!stationCodes.has(from) || !stationCodes.has(to)) return '请选择有效的出发站和到达站'
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '出发日期格式错误'
  const parsed = new Date(`${date}T00:00:00+08:00`)
  if (
    !Number.isFinite(parsed.getTime())
    || new Date(parsed.getTime() + 8 * 3600000).toISOString().slice(0, 10) !== date
  ) return '出发日期无效'
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  const end = new Date(Date.parse(`${today}T00:00:00+08:00`) + 14 * 86400000)
  if (date < today || parsed > end) return '请选择今天起 15 天内的出发日期'
  return ''
}

export function createLeftTicketRouter(fetchImpl = fetch) {
  const router = express.Router()
  router.use(rateLimit(12, 60000))
  router.get('/', async (req, res) => {
    const error = validateQuery(req.query)
    if (error) return res.status(400).json({ success: false, message: error })
    try {
      const { data } = await queryLeftTicketData(req.query, fetchImpl)
      res.json({ success: true, trains: parseTrains(data), queriedAt: new Date().toISOString() })
    } catch (error) {
      const message = error.name === 'TimeoutError' ? '12306 查询超时，请稍后重试' :
        error.message.startsWith('12306') || error.message.startsWith('无法识别') ? error.message : '无法连接 12306，请检查后端网络后重试'
      res.status(502).json({ success: false, message })
    }
  })
  return router
}

export default createLeftTicketRouter()
