import { randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { fetchLcrTimetable, normalizeLcrStops } from '../server/routes/lcrTimetable.js'
import { validListDate } from '../server/routes/lltTrains.js'
import { trainStopsInTimeZone } from '../src/utils/trainTimeZoneDisplay.js'

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dayMs = 86400000
const target = new URL('../server/db/lcr-offline.json', import.meta.url)
const rules = JSON.parse(await readFile(new URL('../data/lcr-offline-rules.json', import.meta.url), 'utf8'))
const input = process.argv[2]
const feed = input ? JSON.parse(await readFile(input, 'utf8')) : await fetchLcrTimetable()
const checkedAt = new Date(feed.checkedAt).toISOString()

function moveDate(date, days) {
  return new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10)
}

const trains = []
for (const [train, rule] of Object.entries(rules.trains)) {
  if (!/^[A-CE-Z]\d{1,5}$/.test(train)) throw new Error(`无效的 LCR 车次 ${train}`)
  const { startDate = rules.startDate, endDate = rules.endDate, weekdays: days = weekdays } = rule
  if (!validListDate(startDate) || !validListDate(endDate) || startDate > endDate
    || !days.length || days.some(day => !weekdays.includes(day))) {
    throw new Error(`${train} 的开行规则无效`)
  }

  const records = feed.trains.filter(row => row.train === train)
  const variants = new Map()
  for (const weekday of new Set(days)) {
    const matches = new Map()
    for (const row of records.filter(item => item.weekdays?.includes(weekday))) {
      const stops = normalizeLcrStops(row.stops, train)
      if (!stops) throw new Error(`${train} ${weekday} 的站点或时刻无法导入`)
      matches.set(JSON.stringify(stops), stops)
    }
    if (matches.size !== 1) throw new Error(`${train} ${weekday} 需要一套明确的时刻`)
    const [[key, stops]] = matches
    if (!variants.has(key)) variants.set(key, { stops, days: [] })
    variants.get(key).days.push(weekday)
  }
  for (const { stops, days } of variants.values()) {
    const beijing = trainStopsInTimeZone(stops, 'beijing', 'vientiane')
    const firstDay = beijing[0].departureDay
    const firstWeekday = new Date(startDate).getUTCDay()
    const mask = days.reduce((sum, day) => sum + 2 ** ((weekdays.indexOf(day) - firstWeekday + 7) % 7), 0)
    trains.push({
      train,
      schedule: {
        startDate: moveDate(startDate, firstDay),
        endDate: moveDate(endDate, firstDay),
        rule: mask === 127 ? null : { period: 7, mask },
      },
      stops: beijing.map(stop => ({
        ...stop,
        arrivalDay: stop.arrival ? stop.arrivalDay - firstDay : 0,
        departureDay: stop.departure ? stop.departureDay - firstDay : stop.arrivalDay - firstDay,
      })),
    })
  }
}

const temporary = new URL(`lcr-offline-${randomUUID()}.tmp`, target)
try {
  await writeFile(temporary, JSON.stringify({ checkedAt, timeZone: 'beijing', trains }, null, 2) + '\n', { flag: 'wx' })
  await rename(temporary, target)
} finally {
  await rm(temporary, { force: true })
}
console.log(`LCR 离线时刻已更新，共 ${trains.length} 套，源时刻更新于 ${checkedAt}`)
