import express from 'express'
import { parseStations } from '../../src/utils/stations.js'
import { stationQueryName } from '../../src/utils/stationName.js'
import { isVientianeStation, stationClock } from '../../src/utils/stationTimeZone.js'
import { rateLimit } from '../security.js'
import { loadLltDatabase } from './lltskb.js'
import { query12306Station, query12306StationForLocalDate } from './station12306.js'
import { listLltStation } from './stationLlt.js'
import { loadLcrOfflineDatabase } from '../db/lcrOffline.js'

const stations = new Map(parseStations().map(station => [station.name, station]))

export async function queryStation(station, date, {
  queryOnline = query12306Station,
  loadDatabase = loadLltDatabase,
  loadLcr = loadLcrOfflineDatabase,
} = {}) {
  const lcrRequest = isVientianeStation(station.name)
    ? loadLcr().then(database => listLltStation(database, station.name, date)
      .map(row => ({ ...row, id: `lcr-${row.id}`, dataset: 'lcr' }))).catch(() => [])
    : []
  let onlineError
  let online
  try {
    online = await query12306StationForLocalDate(station, date, queryOnline)
  } catch (error) {
    onlineError = error
  }
  const lcr = await lcrRequest
  const key = row => JSON.stringify([row.train, row.trainDate, row.from, row.to])
  if (online?.length) {
    const known = new Set(online.map(key))
    const added = lcr.filter(row => !known.has(key(row)))
    return { source: '12306', trains: [...online, ...added], warnings: [], hasLcrOffline: added.length > 0 }
  }
  let database
  try {
    database = await loadDatabase()
  } catch (error) {
    if (!lcr.length) throw error
    return {
      source: '老中铁路（离线）', trains: lcr,
      warnings: ['12306 和路路通未能提供本站数据，当前显示老中铁路离线时刻。'],
    }
  }
  const curated = new Set(lcr.map(key))
  const llt = listLltStation(database, station.name, date).filter(row => !curated.has(key(row)))
  return {
    source: '路路通',
    version: database.version,
    trains: [...llt, ...lcr],
    hasLcrOffline: lcr.length > 0,
    warnings: [
      `${onlineError ? '12306 车站查询暂不可用' : '12306 未返回本站车次'}，现显示路路通离线时刻表（${database.version}）。`,
      '离线时刻按开行规则筛选，仅供参考；临时调图、停运及检票口、出站口、正晚点请以车站公告为准。',
    ],
  }
}

export function createStationRouter(options = {}) {
  const router = express.Router()
  const now = options.now || Date.now
  const cache = new Map()
  const pending = new Map()
  router.use(rateLimit(30, 60000))
  router.get('/', async (req, res) => {
    const name = stationQueryName(req.query.station)
    const station = name ? stations.get(name) || { name, telecode: '' } : null
    const date = stationClock(now(), name).date
    if (!station || (req.query.date != null && req.query.date !== date)) {
      return res.status(400).json({
        success: false,
        message: !station ? '请输入车站名称（不超过 30 个字）' : '车站大屏仅支持查询当天信息',
      })
    }
    // 列表外车站可能都没有电报码，按站名隔离缓存和并发请求。
    const key = `${date}-${station.name}`
    try {
      let entry = cache.get(key)
      if (!entry || now() - entry.cachedAt >= 60000) {
        let task = pending.get(key)
        if (!task) {
          task = queryStation(station, date, options).then(result => {
            const cachedAt = now()
            const value = {
              cachedAt,
              data: {
                ...result, station: station.name, date,
                generatedAt: new Date(cachedAt).toISOString(),
              },
            }
            if (cache.size >= 40) cache.delete(cache.keys().next().value)
            cache.set(key, value)
            return value
          }).finally(() => pending.delete(key))
          pending.set(key, task)
        }
        entry = await task
      }
      if (date !== stationClock(now(), name).date) {
        return res.status(409).json({ success: false, message: '日期已更新，请重新查询当天信息' })
      }
      res.json({ success: true, ...entry.data, total: entry.data.trains.length })
    } catch {
      res.status(502).json({
        success: false,
        message: '12306 和路路通均未能提供车站数据，请稍后重试',
      })
    }
  })
  return router
}

export default createStationRouter()
