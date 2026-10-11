import { displayTrainCode } from './trainDisplay.js'

const daySeconds = 86400

function timeSeconds(value) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value || '')
  if (!match) return Infinity
  const [, hours, minutes, seconds = '0'] = match
  if (+hours > 23 || +minutes > 59 || +seconds > 59) return Infinity
  return +hours * 3600 + +minutes * 60 + +seconds
}

function eventSeconds(time, label) {
  if (time) return timeSeconds(time)
  const match = /^(昨日|次日) (.+)$/.exec(label || '')
  if (!match) return Infinity
  const seconds = timeSeconds(match[2])
  return seconds + (match[1] === '昨日' ? -daySeconds : daySeconds)
}

export function stationRowTiming(row, tab) {
  const arrivalSeconds = eventSeconds(row.arrival, row.arrivalLabel)
  const departureSeconds = eventSeconds(row.departure, row.departureLabel)
  const terminal = Number.isFinite(arrivalSeconds) && !Number.isFinite(departureSeconds)
  const code = displayTrainCode(row.train).split('/')[0].toUpperCase()
  const fastTrain = /^[GDCS]\d+$/.test(code)
  const regularTrain = /^(?:[ZKTY]\d+|\d{4})$/.test(code)
  let leadMinutes = 0
  if (terminal) leadMinutes = 10
  else if (fastTrain || regularTrain) {
    leadMinutes = Number.isFinite(arrivalSeconds) ? 15 : fastTrain ? 20 : 30
  }
  const highlightEndSeconds = terminal ? arrivalSeconds : departureSeconds
  return {
    arrivalSeconds,
    departureSeconds,
    timeSeconds: timeSeconds(tab === 'arrival' ? row.arrival : row.departure || row.arrival),
    highlightStartSeconds: leadMinutes
      ? highlightEndSeconds - leadMinutes * 60 : Infinity,
    highlightEndSeconds,
    highlightLabel: terminal ? '即将终到' : '即将开车',
  }
}

// rows 已按当前标签的到发时间排序；事件发生的那一秒就不再属于下一趟。
export function currentTrainIndex(rows, currentSeconds) {
  let left = 0
  let right = rows.length
  while (left < right) {
    const middle = Math.floor((left + right) / 2)
    if (rows[middle].timeSeconds <= currentSeconds) left = middle + 1
    else right = middle
  }
  return left < rows.length && Number.isFinite(rows[left].timeSeconds) ? left : -1
}

export function currentTrainHighlights(rows, currentSeconds) {
  const nextIndex = currentTrainIndex(rows, currentSeconds)
  const inStation = new Set()
  const upcoming = new Set()
  const highlighted = new Set()
  rows.forEach((row, index) => {
    if (
      Number.isFinite(row.arrivalSeconds) && Number.isFinite(row.departureSeconds)
      && row.arrivalSeconds <= currentSeconds && currentSeconds < row.departureSeconds
    ) {
      inStation.add(index)
      highlighted.add(index)
    } else if (
      row.highlightStartSeconds <= currentSeconds && currentSeconds < row.highlightEndSeconds
    ) {
      upcoming.add(index)
      highlighted.add(index)
    }
  })
  return { nextIndex, inStation, upcoming, highlighted }
}
