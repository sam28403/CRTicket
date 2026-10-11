import { normalizeStationName } from './stationName.js'
import { displayTrainCode } from './trainDisplay.js'

export function stationLocation(name) {
  return {
    path: '/station',
    query: { station: normalizeStationName(name) },
  }
}

export function stationTrainLocation(row, source, date) {
  const offline = source === '路路通'
  return {
    path: '/train',
    query: {
      // 离线查询保留完整记录号，包含双车次及方案后缀。
      train: offline ? row.train : displayTrainCode(row.train).split('/')[0],
      // 本站当天到发的列车可能在前一天或更早始发。
      date: row.trainDate || date,
      ...(offline ? { source: 'llt' } : {}),
    },
  }
}
