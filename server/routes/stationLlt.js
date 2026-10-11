import { normalizeStationName } from '../../src/utils/stationName.js'
import { runsOnDate } from './lltTrains.js'

const dayMs = 86400000
const indexes = new WeakMap()

function stationIndex(database) {
  let index = indexes.get(database)
  if (index) return index
  index = new Map()
  for (const item of database.trains.values()) {
    item.stops.forEach((stop, stopIndex) => {
      const name = normalizeStationName(stop.station)
      if (!index.has(name)) index.set(name, [])
      index.get(name).push({ item, stop, stopIndex })
    })
  }
  indexes.set(database, index)
  return index
}

function originDate(date, day) {
  return new Date(Date.parse(`${date}T00:00:00Z`) - day * dayMs)
    .toISOString().slice(0, 10)
}

export function listLltStation(database, station, date) {
  const rows = []
  for (const { item, stop, stopIndex } of stationIndex(database).get(station) || []) {
    const arrivalDay = stop.arrivalDay || 0
    const departureDay = stop.departureDay ?? arrivalDay
    const dates = new Set()
    if (stop.arrival) dates.add(originDate(date, arrivalDay))
    if (stop.departure) dates.add(originDate(date, departureDay))
    for (const trainDate of dates) {
      // 开行规则针对始发日期，不能直接拿本站当天检查隔日或多日列车。
      if (!runsOnDate(item.schedule, trainDate)) continue
      const arrival = stop.arrival && originDate(date, arrivalDay) === trainDate
        ? stop.arrival : null
      const departure = stop.departure && originDate(date, departureDay) === trainDate
        ? stop.departure : null
      rows.push({
        id: `llt-${item.train}-${trainDate}-${stopIndex}`,
        train: stop.train || item.train,
        from: item.stops[0].station,
        to: item.stops.at(-1).station,
        trainDate,
        arrival,
        departure,
        arrivalLabel: arrival || (stop.arrival ? `昨日 ${stop.arrival}` : '始发站'),
        departureLabel: departure || (stop.departure ? `次日 ${stop.departure}` : '终到站'),
        stay: stop.stay,
        ticketGate: null,
        exit: null,
        departureStatus: null,
        arrivalStatus: null,
      })
    }
  }
  return rows
}
