import express from 'express'
import stationData from '../../src/station_name.js'
import { rateLimit } from '../security.js'
import { isTrainQueryDateInRange } from '../../src/utils/trainQueryDate.js'
import { loadLltDatabase } from './lltskb.js'
import { clockMinutes } from './trainClock.js'

const origin = 'https://kyfw.12306.cn'
const stationCodes = new Map(stationData.split('@').filter(Boolean).map(row => {
  const fields = row.split('|')
  return [fields[1], fields[2]]
}))

export function validateTrainQuery({ train, date }, now = Date.now()) {
  if (typeof train !== 'string' || !/^[A-Z]?\d{1,5}$/.test(train)) return '请输入完整车次，例如 G1、D3068 或 1461'
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '请选择始发日期'
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return '始发日期无效'
  if (!isTrainQueryDateInRange(date, now)) return '请选择今天前 2 天至后 15 天内的始发日期'
  return ''
}

export function matchesTrain(code, train) {
  const parts = String(code || '').toUpperCase().split('/')
  const prefix = parts[0].match(/^[A-Z]+/)?.[0] || ''
  return parts.some(part => part === train || (/^\d+$/.test(part) && `${prefix}${part}` === train))
}

export function normalizeStops(rows, train) {
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row.station_name !== 'string')) {
    throw new Error('车次数据格式发生变化，请稍后重试')
  }
  const clock = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null
  let day = 0
  let previousTime = null
  return rows.map((row, index) => {
    const arrival = index === 0 ? null : clock(row.arrive_time)
    const departure = index === rows.length - 1 ? null : clock(row.start_time)
    const stay = arrival && departure ? (clockMinutes(departure) - clockMinutes(arrival) + 1440) % 1440 : null
    if (arrival && previousTime != null && clockMinutes(arrival) < previousTime) day++
    // 官网提供累计跨日数；备用接口无该字段时按沿途时刻回绕推导。
    if (index > 0 && /^\d+$/.test(String(row.arrive_day_diff ?? ''))) day = Number(row.arrive_day_diff)
    const arrivalDay = day
    if (arrival && departure && clockMinutes(departure) < clockMinutes(arrival)) day++
    if (departure || arrival) previousTime = clockMinutes(departure || arrival)
    return {
      no: row.station_no || String(index + 1), train: row.station_train_code || train,
      station: row.station_name, arrival, departure, stay,
      arrivalDay, mileage: null,
    }
  })
}

// 主查询参数来自 queryTrainInfo_js.js；备用查询按照用户提供的 lltskb_query.py。
async function query12306(train, date, fetchImpl) {
  const signal = AbortSignal.timeout(25000)
  const headers = {
    Referer: `${origin}/otn/queryTrainInfo/init`,
    'User-Agent': 'Mozilla/5.0',
    Accept: 'application/json',
  }
  async function get(url) {
    const response = await fetchImpl(url, { headers, signal, redirect: 'error' })
    if (!response.ok) throw new Error(`查询服务返回 HTTP ${response.status}`)
    const body = await response.json()
    if (body.status === false || (body.httpstatus && body.httpstatus !== 200)) throw new Error('12306 暂未提供查询数据，请稍后重试')
    return body
  }
  const search = await get(`https://search.12306.cn/search/v1/train/search?${new URLSearchParams({
    keyword: train,
    date: date.replaceAll('-', ''),
  })}`)
  if (!Array.isArray(search.data)) throw new Error('12306 车次搜索返回格式异常')
  const candidates = search.data.filter(item => matchesTrain(item.station_train_code, train))
  if (!candidates.length) return { stops: [], source: '12306', warnings: [] }
  // 不使用模糊搜索的第一项，以免把 G1 查询成 G10。
  if (candidates.length > 1) throw new Error('该日期存在多个同名车次，暂时无法确定对应时刻表')
  const item = candidates[0]
  let rows = []
  let primaryError
  try {
    const primary = await get(`${origin}/otn/queryTrainInfo/query?${new URLSearchParams({
      'leftTicketDTO.train_no': item.train_no, 'leftTicketDTO.train_date': date, rand_code: '',
    })}`)
    if (primary.data?.message) throw new Error('12306 主查询暂不可用')
    if (!Array.isArray(primary.data?.data)) throw new Error('12306 主查询返回格式异常')
    rows = primary.data.data
  } catch (error) { primaryError = error }
  let source = '12306'
  if (!rows.length) {
    const codes = new Map(stationCodes)
    if (!codes.has(item.from_station) || !codes.has(item.to_station)) {
      const response = await fetchImpl(`${origin}/otn/resources/js/framework/station_name.js`, {
        headers,
        signal,
        redirect: 'error',
      })
      if (!response.ok) throw new Error('无法获取车站电报码')
      for (const entry of (await response.text()).split('@').slice(1)) {
        const fields = entry.split('|')
        if (/^[A-Z]{3}$/.test(fields[2])) codes.set(fields[1], fields[2])
      }
    }
    if (!codes.has(item.from_station) || !codes.has(item.to_station)) throw new Error('未找到始发站或终到站电报码')
    const fallback = await get(`${origin}/otn/czxx/queryByTrainNo?${new URLSearchParams({
      train_no: item.train_no, from_station_telecode: codes.get(item.from_station),
      to_station_telecode: codes.get(item.to_station), depart_date: date,
    })}`)
    if (!Array.isArray(fallback.data?.data)) throw new Error('12306 备用查询返回格式异常')
    rows = fallback.data.data
    if (!rows.length && primaryError) throw primaryError
    source = '12306（Gist 备用方法）'
  }
  return {
    train: item.station_train_code, date, from: item.from_station, to: item.to_station,
    source, stops: normalizeStops(rows, item.station_train_code),
    warnings: [],
  }
}

export async function queryTrainInfo(train, date, fetchImpl = fetch, loadDatabase = loadLltDatabase) {
  let online
  let onlineError
  try { online = await query12306(train, date, fetchImpl) } catch (error) { onlineError = error }
  let database
  try { database = await loadDatabase() } catch {
    if (onlineError) throw onlineError
    return { ...online, warnings: [online.stops.length ? '路路通数据暂不可用，里程暂缺。' : '12306 未查到车次，路路通数据暂不可用，请稍后重试。'] }
  }
  // B/C 等后缀是离线库中的其他方案，不能仅凭车次前缀选中。
  const candidates = [...database.trains.values()].filter(item =>
    /^[A-Z]?\d+(?:\/[A-Z]?\d+)*$/.test(item.train) && matchesTrain(item.train, train))
  if (online?.stops.length) {
    const matched = candidates.filter(item => item.stops.length === online.stops.length &&
      item.stops.every((stop, index) => stop.station === online.stops[index].station))
    if (matched.length !== 1 || matched[0].stops.some(stop => stop.mileage == null)) {
      return { ...online, warnings: ['路路通未找到站序一致且里程完整的车次记录，里程暂缺。'] }
    }
    return { ...online, mileageVersion: database.version,
      stops: online.stops.map((stop, index) => ({ ...stop, mileage: matched[0].stops[index].mileage })) }
  }
  if (candidates.length === 1) {
    const offline = candidates[0]
    return { ...offline, date, from: offline.stops[0].station, to: offline.stops.at(-1).station,
      source: '路路通（离线参考）', mileageVersion: database.version,
      warnings: [`12306 未提供时刻表，现显示路路通离线数据（${database.version}），不能确认所选日期是否开行。`] }
  }
  if (onlineError) throw onlineError
  return { ...online, warnings: candidates.length > 1 ? ['路路通存在多个同名车次，无法确定对应时刻表。'] : [] }
}

export function createTrainInfoRouter(fetchImpl = fetch, loadDatabase = loadLltDatabase) {
  const router = express.Router()
  router.use(rateLimit(12, 60000))
  router.get('/', async (req, res) => {
    const train = typeof req.query.train === 'string' ? req.query.train.trim().toUpperCase() : req.query.train
    const { date } = req.query
    const error = validateTrainQuery({ train, date })
    if (error) return res.status(400).json({ success: false, message: error })
    try {
      res.json({ success: true, ...await queryTrainInfo(train, date, fetchImpl, loadDatabase) })
    } catch (error) {
      const message = error.name === 'TimeoutError' ? '车次查询超时，请稍后重试' :
        error instanceof TypeError || error instanceof SyntaxError ? '无法获取车次数据，请检查后端网络或稍后重试' : error.message
      res.status(502).json({ success: false, message })
    }
  })
  return router
}

export default createTrainInfoRouter()
