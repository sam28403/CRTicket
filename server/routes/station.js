import express from 'express'
import { parseStations } from '../../src/utils/stations.js'
import { trainQueryRange } from '../../src/utils/trainQueryDate.js'
import { rateLimit } from '../security.js'
import { loadLltDatabase } from './lltskb.js'
import { query12306Station } from './station12306.js'
import { listLltStation } from './stationLlt.js'

const stations = new Map(parseStations().map(station => [station.name, station]))

export async function queryStation(station, date, {
  queryOnline = query12306Station,
  loadDatabase = loadLltDatabase,
} = {}) {
  let onlineError
  try {
    const trains = await queryOnline(station, date)
    if (trains.length) return { source: '12306', trains, warnings: [] }
  } catch (error) {
    onlineError = error
  }
  const database = await loadDatabase()
  return {
    source: '路路通',
    version: database.version,
    trains: listLltStation(database, station.name, date),
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
    const station = typeof req.query.station === 'string'
      ? stations.get(req.query.station.trim()) : null
    const date = trainQueryRange(now()).today
    if (!station || (req.query.date != null && req.query.date !== date)) {
      return res.status(400).json({
        success: false,
        message: !station ? '请从站名列表中选择有效车站' : '车站大屏仅支持查询当天信息',
      })
    }
    const key = `${date}-${station.telecode}`
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
      if (date !== trainQueryRange(now()).today) {
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
