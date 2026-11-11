import express from 'express'
import { rateLimit } from '../security.js'
import { loadLltDatabase } from './lltskb.js'
import { clockMinutes } from './trainClock.js'
import { loadLcrOfflineDatabase } from '../db/lcrOffline.js'

const dayMs = 86400000
const categories = [
  'G', 'D', 'C', 'S', 'Z', 'N', 'V', 'T', 'K', 'L', 'numeric', 'Y',
]
// 新规则 1：启用时替换上方 categories 定义。
// const categories = ['G', 'D', 'C', 'S', 'Z', 'N', 'V', 'Y']
// 新规则 2：启用时替换上方 categories 定义。
// const categories = ['X', 'G', 'T', 'K', 'D', 'C', 'S', 'Z', 'N', 'V', 'Y']

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
  const category = categories.indexOf(
    /^\d{4}[A-Z]*$/.test(first) ? 'numeric' : prefix,
  )
  return [
    category >= 0 ? category : categories.length,
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
      stationCount: item.stops.length,
      mileage: last.mileage,
    })
  }
  rows.sort(compareTrains)
  return { date, version: database.version, total: rows.length, trains: rows }
}

export function findLltTrainCandidates(database, train, date) {
  const exact = database.trains.get(train)
  if (exact && runsOnDate(exact.schedule, date)) return [exact]
  // 完整记录号和方案后缀仍须精确匹配，单车次才按沿途车次号查找。
  if (!/^[A-Z]?\d{1,5}$/.test(train)) return []
  return [...database.trains.values()].filter(item => {
    if (!runsOnDate(item.schedule, date)) return false
    if (!/^[A-Z]?\d+(?:\/[A-Z]?\d+)+$/.test(item.train)) return false
    const parts = item.train.split('/')
    const prefix = parts[0].match(/^[A-Z]/)?.[0] || ''
    return parts.some(part => (/^\d/.test(part) ? `${prefix}${part}` : part) === train)
  })
}

function offlineTrainDetail(item, train, date, database, dataset) {
  const stops = item?.stops || []
  return {
    train: item?.train || train,
    date,
    source: dataset === 'lcr' ? '老中铁路（离线）' : '路路通',
    ...(dataset === 'lcr' ? { dataset, timeZone: 'beijing', defaultTimeZone: 'vientiane' } : { mileageVersion: database.version }),
    from: stops[0]?.station || '',
    to: stops.at(-1)?.station || '',
    stops,
    warnings: [],
  }
}

export function createLltTrainsRouter(loadDatabase = loadLltDatabase, loadLcr = loadLcrOfflineDatabase) {
  const router = express.Router()
  // 每个数据库版本仅保留最近 8 个日期的摘要，避免重复排序与无限增长。
  const summaries = new WeakMap()
  router.use(rateLimit(30, 60000))
  router.get('/detail', async (req, res) => {
    const { train, date, dataset } = req.query
    if (
      !validListDate(date)
      || typeof train !== 'string'
      || !/^[A-Z]?\d{1,5}[A-Z]?(?:\/[A-Z]?\d{1,5}[A-Z]?)*$/.test(train)
      || train.length > 40
      || (dataset != null && dataset !== 'lcr')
    ) {
      return res.status(400).json({
        success: false,
        message: '请选择有效车次和始发日期',
      })
    }
    try {
      const [llt, lcr] = await Promise.allSettled([
        dataset === 'lcr' ? null : loadDatabase(),
        loadLcr(),
      ])
      const lcrTrains = [...(lcr.value?.trains.values() ?? [])]
        .filter(item => item.train === train && runsOnDate(item.schedule, date))
        .map(item => offlineTrainDetail(item, train, date, lcr.value, 'lcr'))
      if (dataset === 'lcr') {
        if (lcr.status === 'rejected') throw lcr.reason
        const [primary, ...alternatives] = lcrTrains
        return res.json({ success: true, ...(primary ?? offlineTrainDetail(null, train, date, lcr.value, 'lcr')), alternatives })
      }
      if (llt.status === 'rejected' && !lcrTrains.length) throw llt.reason
      const candidates = llt.value ? findLltTrainCandidates(llt.value, train, date) : []
      if (candidates.length > 1) {
        return res.status(409).json({
          success: false,
          message: '该日期存在多个同名车次，请从车次列表选择完整车次',
        })
      }
      if (!candidates.length && lcrTrains.length) {
        const [primary, ...alternatives] = lcrTrains
        return res.json({ success: true, ...primary, alternatives })
      }
      if (!candidates.length && lcr.status === 'rejected') throw lcr.reason
      res.json({ success: true, ...offlineTrainDetail(candidates[0], train, date, llt.value, 'llt'), alternatives: lcrTrains })
    } catch (error) {
      res.status(502).json({
        success: false,
        message: error.name === 'TimeoutError'
          ? '离线时刻表下载超时，请稍后重试'
          : '无法读取离线时刻表，请稍后重试',
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
      const [llt, lcr] = await Promise.allSettled([loadDatabase(), loadLcr()])
      const domestic = llt.value ? summary(llt.value, date) : null
      const lcrRows = lcr.value
        ? summary(lcr.value, date).trains.map(row => ({ ...row, dataset: 'lcr' }))
        : []
      if (!domestic && !lcrRows.length) throw llt.reason
      const trains = lcrRows.length ? [...(domestic?.trains ?? []), ...lcrRows].sort(compareTrains) : domestic.trains
      const warnings = []
      if (!domestic) warnings.push('路路通离线时刻表暂不可用')
      if (lcr.status === 'rejected') warnings.push('老中铁路离线时刻表暂不可用')
      res.json({
        success: true, date, version: domestic?.version, total: trains.length, trains, warnings,
        ...(lcrRows.length ? { lcrVersion: lcr.value.version } : {}),
      })
    } catch (error) {
      res.status(502).json({
        success: false,
        message: error.name === 'TimeoutError'
          ? '离线时刻表下载超时，请稍后重试'
          : '无法读取离线时刻表，请稍后重试',
      })
    }
  })

  function summary(database, date) {
    let cache = summaries.get(database)
    if (!cache) summaries.set(database, cache = new Map())
    if (cache.has(date)) return cache.get(date)
    const result = listLltTrains(database, date)
    if (cache.size >= 8) cache.delete(cache.keys().next().value)
    cache.set(date, result)
    return result
  }
  return router
}

export default createLltTrainsRouter()
