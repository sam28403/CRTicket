import { trainQueryRange } from './trainQueryDate.js'

export const boardTabs = [
  { name: 'all', label: '全部信息' },
  { name: 'departure', label: '出发大屏' },
  { name: 'arrival', label: '到达大屏' },
]

export function stationClock(now = Date.now()) {
  const text = new Date(now + 8 * 3600000).toISOString()
  return {
    date: trainQueryRange(now).today,
    time: text.slice(11, 19),
    minutes: Number(text.slice(11, 13)) * 60 + Number(text.slice(14, 16)),
  }
}

function minutes(time) {
  const parts = time?.split(':').map(Number)
  return parts?.length === 2 ? parts[0] * 60 + parts[1] : Infinity
}

export function stationBoardRows(trains, tab) {
  return trains
    .filter(row => tab === 'all' || Boolean(row[tab]))
    .map(row => ({
      ...row,
      timeMinutes: minutes(tab === 'arrival' ? row.arrival : row.departure || row.arrival),
      status: tab === 'arrival'
        ? row.arrivalStatus : row.departureStatus || row.arrivalStatus,
      stayLabel: row.stay == null ? '—' : `${row.stay} 分钟`,
    }))
    .sort((a, b) => a.timeMinutes - b.timeMinutes || a.train.localeCompare(b.train, 'en', { numeric: true }))
}

export function currentTrainIndex(rows, currentMinutes) {
  if (!rows.length) return -1
  let left = 0
  let right = rows.length
  while (left < right) {
    const middle = Math.floor((left + right) / 2)
    if (rows[middle].timeMinutes < currentMinutes) left = middle + 1
    else right = middle
  }
  return Math.min(left, rows.length - 1)
}

export function stationBoardColumns(rows, tab) {
  const fields = [
    ['train', '车次', 110],
    ...(tab !== 'departure' ? [['from', '始发站', 140]] : []),
    ...(tab !== 'arrival' ? [['to', '终到站', 140]] : []),
    ...(tab !== 'departure' ? [['arrivalLabel', '到达时间', 125]] : []),
    ...(tab !== 'arrival' ? [['departureLabel', '开车时间', 125]] : []),
    ...(tab === 'all' ? [['stayLabel', '停留时间', 110]] : []),
  ]
  const gate = tab === 'arrival' ? ['exit', '出站口', 160] : ['ticketGate', '检票口', 160]
  if (rows.some(row => row[gate[0]])) fields.push(gate)
  if (rows.some(row => row.status)) fields.push(['status', '正晚点', 140])
  return fields.map(([key, title, width]) => ({ key, dataKey: key, title, width }))
}
