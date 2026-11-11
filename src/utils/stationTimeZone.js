import { normalizeStationName } from './stationName.js'

const vientianeStations = new Set([
  '磨丁', '纳堆', '纳磨', '孟赛', '孟阿', '琅勃拉邦', '卡西', '嘎西', '万荣',
  '蓬洪', '蓬宋', '万象北', '万象', '万象南',
])

export function isVientianeStation(station) {
  return vientianeStations.has(normalizeStationName(station))
}

export function stationClock(now = Date.now(), station) {
  const offset = isVientianeStation(station) ? 7 : 8
  const text = new Date(now + offset * 3600000).toISOString()
  return {
    date: text.slice(0, 10),
    time: text.slice(11, 19),
    minutes: Number(text.slice(11, 13)) * 60 + Number(text.slice(14, 16)),
    seconds: Number(text.slice(11, 13)) * 3600
      + Number(text.slice(14, 16)) * 60 + Number(text.slice(17, 19)),
  }
}

const minutesPerDay = 24 * 60

export function shiftClock(clock, day, offset) {
  const [hours, minutes] = clock.split(':').map(Number)
  const shifted = hours * 60 + minutes + offset
  const minuteOfDay = (shifted + minutesPerDay) % minutesPerDay
  const hourText = String(Math.floor(minuteOfDay / 60)).padStart(2, '0')
  const minuteText = String(minuteOfDay % 60).padStart(2, '0')
  return { clock: `${hourText}:${minuteText}`, day: day + Math.floor(shifted / minutesPerDay) }
}
