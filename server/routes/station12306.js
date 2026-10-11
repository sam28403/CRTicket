import { normalizeStationName } from '../../src/utils/stationName.js'
import { clockMinutes } from './trainClock.js'

const origin = 'https://kyfw.12306.cn'
const clock = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null

function optionalText(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text && !['--', '—', '暂无', '未知'].includes(text) ? text : null
}

export function normalizeStationTrains(rows, station, date) {
  if (!Array.isArray(rows)) throw new Error('12306 车站查询返回格式异常')
  return rows.map((row, index) => {
    if (
      !row || typeof row.station_train_code !== 'string'
      || !row.station_train_code.trim()
      || typeof row.start_station_name !== 'string'
      || typeof row.end_station_name !== 'string'
      || normalizeStationName(row.station_name) !== station.name
    ) {
      throw new Error('12306 车站数据字段不完整')
    }
    // 官网这两个字段为本站到发时间；start_start_time/end_arrive_time 是全程端点时间。
    const arrival = station.name === normalizeStationName(row.start_station_name)
      ? null : clock(row.arrive_time)
    const departure = station.name === normalizeStationName(row.end_station_name)
      ? null : clock(row.start_time)
    if (!arrival && !departure) throw new Error('12306 车站数据缺少到发时间')
    const departureAfterToday = Boolean(arrival && departure && departure < arrival)
    return {
      id: `12306-${row.train_no || row.station_train_code}-${index}`,
      train: row.station_train_code.trim(),
      from: row.start_station_name,
      to: row.end_station_name,
      trainDate: row.start_train_date || date,
      arrival,
      departure: departureAfterToday ? null : departure,
      arrivalLabel: arrival || '始发站',
      departureLabel: departureAfterToday ? `次日 ${departure}` : departure || '终到站',
      stay: arrival && departure
        ? (clockMinutes(departure) - clockMinutes(arrival) + 1440) % 1440
        : null,
      // 不把 isEnabled、余票或检票状态当作正晚点，也不默认“正点”。
      ticketGate: optionalText(row.checkin ?? row.checkin_gate),
      exit: optionalText(row.exit ?? row.exit_gate),
      departureStatus: optionalText(row.departure_status ?? row.late_status),
      arrivalStatus: optionalText(row.arrival_status ?? row.late_status),
    }
  })
}

export async function query12306Station(station, date, fetchImpl = fetch) {
  const signal = AbortSignal.timeout(12000)
  const headers = {
    Referer: `${origin}/otn/czxx/init`,
    'User-Agent': 'Mozilla/5.0',
    Accept: 'application/json',
  }
  const init = await fetchImpl(`${origin}/otn/czxx/init`, {
    headers, signal, redirect: 'error',
  })
  if (!init.ok) throw new Error(`12306 初始化失败（HTTP ${init.status}）`)
  const cookies = init.headers.getSetCookie?.() || []
  if (cookies.length) headers.Cookie = cookies.map(value => value.split(';')[0]).join('; ')
  await init.body?.cancel()
  // 参数来自官方 /otn/resources/merged/czxxcx_js.js 的 execute_search。
  const params = new URLSearchParams({
    train_start_date: date,
    train_station_name: station.name,
    train_station_code: station.telecode,
    randCode: '',
  })
  const response = await fetchImpl(`${origin}/otn/czxx/query?${params}`, {
    headers, signal, redirect: 'error',
  })
  if (!response.ok) throw new Error(`12306 车站查询失败（HTTP ${response.status}）`)
  const body = await response.json()
  if (body.status === false || body.data?.flag !== true) {
    throw new Error('12306 车站查询暂不可用')
  }
  return normalizeStationTrains(body.data.data, station, date)
}
