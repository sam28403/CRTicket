import express from 'express'
import stationData from '../../src/station_name.js'
import { rateLimit } from '../security.js'
import { parseSeats } from './leftTicketSeats.js'

const origin = 'https://kyfw.12306.cn'
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
  if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 8 * 3600000).toISOString().slice(0, 10) !== date) return '出发日期无效'
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
    const signal = AbortSignal.timeout(20000)
    const headers = { Referer: `${origin}/otn/leftTicket/init`, 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
    try {
      // 从官网初始化页面读取当前接口，不固定依赖 queryG 等可能变化的名称。
      const init = await fetchImpl(`${origin}/otn/leftTicket/init`, { headers, signal, redirect: 'error' })
      if (!init.ok) throw new Error(`12306 初始化失败（HTTP ${init.status}）`)
      const html = await init.text()
      let path = html.match(/CLeftTicketUrl\s*=\s*['"](leftTicket\/query[A-Za-z]*)['"]/)?.[1]
      if (!path) throw new Error('无法识别 12306 查询接口，官网可能需要验证或已更新')
      const cookies = init.headers.getSetCookie?.().map(value => value.split(';')[0]).join('; ')
      if (cookies) headers.Cookie = cookies
      const params = new URLSearchParams({ 'leftTicketDTO.train_date': req.query.date,
        'leftTicketDTO.from_station': req.query.from, 'leftTicketDTO.to_station': req.query.to, purpose_codes: 'ADULT' })
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetchImpl(`${origin}/otn/${path}?${params}`, { headers, signal, redirect: 'error' })
        if (!response.ok) throw new Error(`12306 查询失败（HTTP ${response.status}），请稍后重试或访问官网`)
        let body
        try { body = await response.json() } catch { throw new Error('12306 未返回余票数据，可能需要官网验证，请稍后重试') }
        if (body.status === true) {
          return res.json({ success: true, trains: parseTrains(body.data), queriedAt: new Date().toISOString() })
        }
        // 仅跟随官网明确返回的同源查询路径，不接受任意 URL。
        if (attempt === 0 && /^leftTicket\/query[A-Za-z]*$/.test(body.c_url)) { path = body.c_url; continue }
        throw new Error('12306 暂未提供余票数据，请检查预售日期或在官网查询')
      }
    } catch (error) {
      const message = signal.aborted ? '12306 查询超时，请稍后重试' :
        error.message.startsWith('12306') || error.message.startsWith('无法识别') ? error.message : '无法连接 12306，请检查后端网络后重试'
      res.status(502).json({ success: false, message })
    }
  })
  return router
}

export default createLeftTicketRouter()
