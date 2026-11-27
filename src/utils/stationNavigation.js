import { normalizeStationName } from './stationName.js'
import { displayTrainCode } from './trainDisplay.js'

export function stationLocation(name) {
  return {
    path: '/station',
    query: { station: normalizeStationName(name) },
  }
}

export function stationTrainLocation(row, source, date) {
  const offline = row.dataset === 'lcr' || source === '路路通'
  const train = (row.queryTrain || !offline) ? displayTrainCode(row.train).split('/')[0] : row.train
  return {
    path: '/train',
    query: {
      train,
      ...(row.queryTrain && row.queryTrain !== train ? { record: row.queryTrain } : {}),
      // 本站当天到发的列车可能在前一天或更早始发。
      date: row.trainDate || date,
      ...(offline ? { source: 'llt' } : {}),
      ...(row.dataset === 'lcr' ? { dataset: 'lcr' } : {}),
    },
  }
}
