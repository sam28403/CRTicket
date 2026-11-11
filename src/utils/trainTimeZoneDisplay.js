import { normalizeStationName } from './stationName.js'
import { displayTrainCode } from './trainDisplay.js'
import { isVientianeStation, shiftClock } from './stationTimeZone.js'

export const trainTimeZones = [
  { value: 'local', label: '当地时间' },
  { value: 'beijing', label: '北京时间' },
  { value: 'vientiane', label: '万象时间' },
]

export function hasTrainTimeZoneOptions(code) {
  const parts = displayTrainCode(code).toUpperCase().split('/')
  const prefix = parts[0].match(/^[A-Z]+/)?.[0] || ''
  return parts.some(part => {
    const train = /^\d+$/.test(part) ? prefix + part : part
    return /^(D8[3-8]|Y2[5-8])$/.test(train)
  })
}

function shiftStop(stop, offset) {
  const arrivalDay = stop.arrivalDay ?? 0
  const departureDay = stop.departureDay ?? (
    arrivalDay + Number(Boolean(stop.arrival && stop.departure && stop.departure < stop.arrival))
  )
  const arrival = stop.arrival && shiftClock(stop.arrival, arrivalDay, offset)
  const departure = stop.departure && shiftClock(stop.departure, departureDay, offset)

  return {
    ...stop,
    arrival: arrival ? arrival.clock : stop.arrival,
    arrivalDay: arrival ? arrival.day : arrivalDay,
    departure: departure ? departure.clock : stop.departure,
    departureDay: departure ? departure.day : departureDay,
  }
}

export function trainStopsInTimeZone(stops, zone, sourceZone = 'beijing') {
  if (sourceZone === 'vientiane') {
    return zone === 'beijing' ? stops.map(stop => shiftStop(stop, 60)) : stops
  }
  if (zone === 'beijing') return stops

  // 12306 和路路通的跨境时刻按北京时间记录，包含两个口岸时按站序识别老挝段。
  const stations = stops.map(stop => normalizeStationName(stop.station))
  const mohan = stations.indexOf('磨憨')
  const boten = stations.indexOf('磨丁')

  return stops.map((stop, index) => {
    const inLaos = mohan >= 0 && boten >= 0
      ? (boten > mohan ? index >= boten : index <= boten)
      : isVientianeStation(stations[index])
    return zone === 'vientiane' || inLaos ? shiftStop(stop, -60) : stop
  })
}
