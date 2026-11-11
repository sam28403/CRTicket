import { clockMinutes } from './trainClock.js'

const timetableUrl = 'https://laosbustickets.com/data/laos-train-timetable.json'
const sourceUrl = 'https://laosbustickets.com/train-tickets-laos/#timetable'
const dayMs = 24 * 60 * 60 * 1000
const retryMs = 15 * 60 * 1000
// 万象 06:00 发布，留五分钟供上游完成更新。
const publishHourMs = 23 * 60 * 60 * 1000
const refreshHourMs = publishHourMs + 5 * 60 * 1000
// 万象起算的线路里程，取自 D88 经由里程表。
const stations = new Map([
  ['LAVTM', { name: '万象', km: 0 }],
  ['LAVQM', { name: '蓬洪', km: 64 }],
  ['LAVOM', { name: '万荣', km: 123 }],
  ['LAVMM', { name: '嘎西', km: 167 }],
  ['LAVJM', { name: '琅勃拉邦', km: 239 }],
  ['LAVHM', { name: '孟阿', km: 293 }],
  ['LAVFM', { name: '孟赛', km: 339 }],
  ['LAVDM', { name: '纳磨', km: 378 }],
  ['LAVCM', { name: '纳堆', km: 394 }],
  ['LAVBM', { name: '磨丁', km: 406 }],
])

const validClock = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

function normalizeLcrStops(rows, train) {
  if (!Array.isArray(rows) || rows.length < 2) return null
  const valid = rows.every((row, index) =>
    row?.country === 'LA' && row.utcOffset === '+07:00' && stations.has(row.code)
    && (index === 0 || validClock(row.arrive))
    && (index === rows.length - 1 || validClock(row.depart)))
  if (!valid) return null

  const originKm = stations.get(rows[0].code).km
  let day = 0
  let previous = null
  return rows.map((row, index) => {
    const { name, km } = stations.get(row.code)
    const arrival = index === 0 ? null : row.arrive
    const departure = index === rows.length - 1 ? null : row.depart
    if (arrival && previous && arrival < previous) day++
    const arrivalDay = day
    if (arrival && departure && departure < arrival) day++
    previous = departure || arrival
    return {
      no: String(index + 1).padStart(2, '0'),
      train,
      station: name,
      arrival,
      departure,
      arrivalDay,
      departureDay: day,
      stay: arrival && departure
        ? (day - arrivalDay) * 1440 + clockMinutes(departure) - clockMinutes(arrival)
        : null,
      mileage: Math.abs(km - originKm),
    }
  })
}

function parseLcrTimetable(data) {
  const checkedAt = Date.parse(data?.checkedAt)
  if (!Number.isFinite(checkedAt) || !Array.isArray(data?.trains)) {
    throw new Error('老中铁路时刻表格式异常')
  }
  const trains = new Map()
  for (const row of data.trains) {
    if (typeof row?.train !== 'string' || row.train.startsWith('D') || !/^[A-Z]?\d{1,5}$/.test(row.train)) continue
    if (!Array.isArray(row.runsOn)) continue
    const stops = normalizeLcrStops(row.stops, row.train)
    if (!stops) continue
    const schedules = trains.get(row.train) ?? []
    schedules.push({ dates: new Set(row.runsOn), stops })
    trains.set(row.train, schedules)
  }
  return { checkedAt, trains }
}

export function createLcrTimetableLoader(fetchImpl = fetch, now = Date.now) {
  let cached
  let pending
  let refreshAt = 0

  return async function load() {
    if (pending) return pending
    const time = now()
    if (time < refreshAt) return cached

    const refreshDay = Math.floor((time - refreshHourMs) / dayMs) * dayMs
    pending = (async () => {
      try {
        const response = await fetchImpl(timetableUrl, {
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        })
        if (!response.ok) throw new Error('老中铁路时刻表下载失败')
        const next = parseLcrTimetable(await response.json())
        if (!cached || next.checkedAt >= cached.checkedAt) cached = next
        const publishedDay = Math.floor((cached.checkedAt - publishHourMs) / dayMs) * dayMs
        refreshAt = publishedDay >= refreshDay
          ? publishedDay + refreshHourMs + dayMs
          : time + retryMs
      } catch {
        refreshAt = time + retryMs
      }
      return cached
    })()
    try {
      return await pending
    } finally {
      pending = null
    }
  }
}

export async function queryLcrTimetable(train, date, load) {
  if (train.startsWith('D')) return []
  const timetable = await load()
  const results = new Map()
  for (const { dates, stops } of timetable?.trains.get(train) ?? []) {
    if (!dates.has(date)) continue
    results.set(JSON.stringify(stops), {
      train,
      date,
      from: stops[0].station,
      to: stops.at(-1).station,
      stops,
      source: 'Laos Bus Tickets',
      sourceUrl,
      timeZone: 'vientiane',
      warnings: [],
    })
  }
  return [...results.values()]
}
