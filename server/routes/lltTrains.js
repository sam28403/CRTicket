import express from 'express'
import { rateLimit } from '../security.js'
import { loadLltDatabase } from './lltskb.js'
import { clockMinutes } from './trainClock.js'

const dayMs = 86400000
const categories = ['G', 'D', 'C', 'S', 'Z', 'T', 'K', 'L']

export function validListDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

export function runsOnDate(schedule, date) {
  // 缺少日期元数据时不能把记录当作每天开行。
  if (!schedule?.startDate || !schedule.endDate) return false
  if (date < schedule.startDate || date > schedule.endDate) return false
  if (!schedule.rule) return true
  const days = (
    Date.parse(`${date}T00:00:00Z`) - Date.parse(`${schedule.startDate}T00:00:00Z`)
  ) / dayMs
  return Math.floor(schedule.rule.mask / 2 ** (days % schedule.rule.period)) % 2 === 1
}

function sortKey(train) {
  const first = train.split('/')[0]
  const prefix = first.match(/^[A-Z]/)?.[0]
  const category = categories.indexOf(prefix)
  return [
    category >= 0 ? category : /^\d{4}[A-Z]*$/.test(first) ? 8 : 9,
    Number(first.match(/\d+/)?.[0] || 0),
  ]
}

export function compareTrains(a, b) {
  const left = sortKey(a.train)
  const right = sortKey(b.train)
  return left[0] - right[0]
    || left[1] - right[1]
    || a.train.localeCompare(b.train, 'en', { numeric: true })
}

export function listLltTrains(database, date) {
  const rows = []
  for (const item of database.trains.values()) {
    if (!runsOnDate(item.schedule, date)) continue
    const first = item.stops[0]
    const last = item.stops.at(-1)
    const elapsed = first.departure && last.arrival
      ? (last.arrivalDay - (first.departureDay || 0)) * 1440
        + clockMinutes(last.arrival) - clockMinutes(first.departure)
      : null
    const duration = elapsed == null || elapsed < 0
      ? null
      : `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
    rows.push({
      train: item.train,
      from: first.station,
      to: last.station,
      duration,
      mileage: last.mileage,
    })
  }
  rows.sort(compareTrains)
  return { date, version: database.version, total: rows.length, trains: rows }
}

export function createLltTrainsRouter(loadDatabase = loadLltDatabase) {
  const router = express.Router()
  // 每个数据库版本仅保留最近 8 个日期的摘要，避免重复排序与无限增长。
  const summaries = new WeakMap()
  router.use(rateLimit(30, 60000))
  router.get('/detail', async (req, res) => {
    const { train, date } = req.query
    if (
      !validListDate(date)
      || typeof train !== 'string'
      || !/^[A-Z]?\d{1,5}[A-Z]?(?:\/[A-Z]?\d{1,5}[A-Z]?)*$/.test(train)
      || train.length > 40
    ) {
      return res.status(400).json({
        success: false,
        message: '请选择有效车次和始发日期',
      })
    }
    try {
      const database = await loadDatabase()
      const item = database.trains.get(train)
      const stops = item && runsOnDate(item.schedule, date) ? item.stops : []
      res.json({
        success: true,
        train,
        date,
        source: '路路通（离线时刻表）',
        mileageVersion: database.version,
        from: stops[0]?.station || '',
        to: stops.at(-1)?.station || '',
        stops,
        warnings: [],
      })
    } catch (error) {
      res.status(502).json({
        success: false,
        message: error.name === 'TimeoutError'
          ? '离线时刻表下载超时，请稍后重试'
          : '无法读取路路通离线时刻表，请检查后端网络后重试',
      })
    }
  })
  router.get('/', async (req, res) => {
    const { date } = req.query
    if (!validListDate(date)) {
      return res.status(400).json({
        success: false,
        message: '请选择有效日期',
      })
    }
    try {
      const database = await loadDatabase()
      let cache = summaries.get(database)
      if (!cache) summaries.set(database, cache = new Map())
      let result = cache.get(date)
      if (!result) {
        result = listLltTrains(database, date)
        if (cache.size >= 8) cache.delete(cache.keys().next().value)
        cache.set(date, result)
      }
      res.json({ success: true, ...result })
    } catch (error) {
      res.status(502).json({
        success: false,
        message: error.name === 'TimeoutError'
          ? '离线时刻表下载超时，请稍后重试'
          : '无法读取路路通离线时刻表，请检查后端网络后重试',
      })
    }
  })
  return router
}

export default createLltTrainsRouter()
