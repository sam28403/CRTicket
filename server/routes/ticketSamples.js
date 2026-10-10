import express from 'express'
import stationData from '../../src/station_name.js'
import { normalizeStationName } from '../../src/utils/stationName.js'
import { trainQueryRange, isTrainQueryDateInRange } from '../../src/utils/trainQueryDate.js'
import { rateLimit } from '../security.js'
import { loadLltDatabase } from './lltskb.js'
import { validListDate, runsOnDate } from './lltTrains.js'
import { matchesTrain, queryTrainInfo } from './trainInfo.js'
import { queryLeftTicketData, queryTicketPrices } from './leftTicketClient.js'
import { parseTrains, validateQuery } from './leftTicket.js'
import { parseTicketFares } from './ticketFares.js'
import { clockMinutes } from './trainClock.js'

const codes = new Map(stationData.split('@').filter(Boolean).map(row => {
  const fields = row.split('|')
  return [normalizeStationName(fields[1]), fields[2]]
}))
const validClock = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
const choose = (items, random) => items[Math.floor(random() * items.length)]

export function sampleInterval(stops, date, random = Math.random) {
  const departures = []
  const { today, max } = trainQueryRange()
  for (let index = 0; index < stops.length - 1; index++) {
    const stop = stops[index]
    if (!validClock(stop.departure) || !Number.isFinite(stop.mileage)) continue
    if (!codes.has(normalizeStationName(stop.station))) continue
    // 在线时刻表没有 departureDay 时，用午夜停站跨日推导。
    const day = stop.departureDay ?? (stop.arrivalDay + (
      validClock(stop.arrival) && clockMinutes(stop.departure) < clockMinutes(stop.arrival) ? 1 : 0
    ))
    if (!Number.isInteger(day) || day < 0) continue
    const travelDate = new Date(Date.parse(`${date}T00:00:00Z`) + day * 86400000)
      .toISOString().slice(0, 10)
    // 余票预售窗口是今天起 15 天；max 是时刻表查询窗口的第 16 天。
    if (travelDate < today || travelDate >= max) continue
    const arrivalIndices = stops.flatMap((end, endIndex) => {
      const elapsed = end.arrivalDay * 1440 + (validClock(end.arrival) ? clockMinutes(end.arrival) : NaN)
        - day * 1440 - clockMinutes(stop.departure)
      return endIndex > index && Number.isFinite(end.mileage) && end.mileage > stop.mileage
        && codes.has(normalizeStationName(end.station)) && elapsed > 0 ? [endIndex] : []
    })
    if (arrivalIndices.length) departures.push({ index, arrivalIndices, travelDate })
  }
  if (!departures.length) return null
  const { index, arrivalIndices, travelDate } = choose(departures, random)
  return { from: stops[index], to: stops[choose(arrivalIndices, random)], travelDate }
}

export async function queryTicketSample(date, {
  fetchImpl = fetch,
  loadDatabase = loadLltDatabase,
  trainQuery = queryTrainInfo,
  random = Math.random,
} = {}) {
  const database = await loadDatabase()
  const candidates = [...database.trains.values()].filter(item =>
    /^[GCDZTKLYS]?\d{1,4}(?:\/[A-Z]?\d{1,4})*$/.test(item.train)
    && runsOnDate(item.schedule, date)
    && sampleInterval(item.stops, date, () => 0))
  if (!candidates.length) throw new Error('离线库中没有该日期开行且里程完整的可用车次')
  const candidate = choose(candidates, random)
  const code = candidate.train.split('/')[0]
  const info = await trainQuery(code, date, fetchImpl, async () => database)
  if (!info.source?.startsWith('12306') || !info.stops?.length || !info.mileageVersion) {
    return { sample: null, reason: `${code} 未取得在线时刻表或匹配里程，已跳过` }
  }
  const interval = sampleInterval(info.stops, date, random)
  if (!interval) return { sample: null, reason: `${code} 没有完整可用的乘车区间，已跳过` }
  const { from, to, travelDate } = interval
  const query = {
    from: codes.get(normalizeStationName(from.station)),
    to: codes.get(normalizeStationName(to.station)),
    date: travelDate,
  }
  const validation = validateQuery(query)
  if (validation) throw new Error(validation)
  const { data, headers } = await queryLeftTicketData(query, fetchImpl)
  const rows = parseTrains(data)
  const matches = rows.flatMap((row, index) => {
    const fields = data.result[index].split('|')
    return matchesTrain(fields[3], code)
      && fields[13] === date.replaceAll('-', '')
      && Number(fields[16]) === Number(from.no)
      && Number(fields[17]) === Number(to.no)
      && row.departure === from.departure && row.arrival === to.arrival
      && normalizeStationName(row.from) === normalizeStationName(from.station)
      && normalizeStationName(row.to) === normalizeStationName(to.station)
      && row.canBuy ? [{ row, fields }] : []
  })
  if (matches.length !== 1) return { sample: null, reason: `${code} 区间余票与时刻表未唯一匹配，已跳过` }
  const { row, fields } = matches[0]
  // 明细优先，缺少完整报价时才访问单独的票价接口。
  let fares = parseTicketFares(fields)
  if (!fares.length) {
    fares = parseTicketFares(fields, await queryTicketPrices(fields, travelDate, headers, fetchImpl))
  }
  if (!fares.length) return { sample: null, reason: `${code} 未取得明确席别与票价，已跳过` }
  return {
    sample: {
      trainNo: row.train,
      from: normalizeStationName(row.from),
      to: normalizeStationName(row.to),
      date: travelDate,
      time: row.departure,
      distance: to.mileage - from.mileage,
      fares,
      source: '12306 + 路路通',
      mileageVersion: info.mileageVersion,
      queriedAt: new Date().toISOString(),
    },
  }
}

export function createTicketSamplesRouter(options = {}) {
  const router = express.Router()
  router.use(rateLimit(30, 60000))
  router.get('/', async (req, res) => {
    const { date } = req.query
    if (!validListDate(date) || !isTrainQueryDateInRange(date) || date >= trainQueryRange().max) {
      return res.status(400).json({ success: false, message: '请选择今天前 2 天至后 14 天内的始发日期' })
    }
    try {
      res.json({ success: true, ...await queryTicketSample(date, options) })
    } catch (error) {
      const message = error.name === 'TimeoutError' ? '真实车票数据查询超时，请重试'
        : error instanceof TypeError || error instanceof SyntaxError
          ? '无法读取真实车票数据，请检查后端网络后重试' : error.message
      res.status(502).json({ success: false, message })
    }
  })
  return router
}

export default createTicketSamplesRouter()
