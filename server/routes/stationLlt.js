import { normalizeStationName } from '../../src/utils/stationName.js'
import { isVientianeStation, shiftClock } from '../../src/utils/stationTimeZone.js'
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
  const offset = isVientianeStation(station) ? -60 : 0
  for (const { item, stop, stopIndex } of stationIndex(database).get(station) || []) {
    const arrivalDay = stop.arrivalDay || 0
    const departureDay = stop.departureDay ?? arrivalDay
    const localArrival = stop.arrival ? shiftClock(stop.arrival, arrivalDay, offset) : null
    const localDeparture = stop.departure ? shiftClock(stop.departure, departureDay, offset) : null
    const arrivalDate = localArrival && originDate(date, localArrival.day)
    const departureDate = localDeparture && originDate(date, localDeparture.day)
    const dates = new Set()
    if (arrivalDate) dates.add(arrivalDate)
    if (departureDate) dates.add(departureDate)
    for (const trainDate of dates) {
      // 开行规则针对始发日期，不能直接拿本站当天检查隔日或多日列车。
      if (!runsOnDate(item.schedule, trainDate)) continue
      const arrival = arrivalDate === trainDate ? localArrival.clock : null
      const departure = departureDate === trainDate ? localDeparture.clock : null
      rows.push({
        id: `llt-${item.train}-${trainDate}-${stopIndex}`,
        train: stop.train || item.train,
        from: item.stops[0].station,
        to: item.stops.at(-1).station,
        trainDate,
        arrival,
        departure,
        arrivalLabel: arrival || (localArrival ? `昨日 ${localArrival.clock}` : '始发站'),
        departureLabel: departure || (localDeparture ? `次日 ${localDeparture.clock}` : '终到站'),
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
