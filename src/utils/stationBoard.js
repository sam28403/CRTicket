import { trainQueryRange } from './trainQueryDate.js'
import { stationRowTiming } from './stationBoardTime.js'

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
    seconds: Number(text.slice(11, 13)) * 3600
      + Number(text.slice(14, 16)) * 60 + Number(text.slice(17, 19)),
  }
}

export function stationBoardRows(trains, tab) {
  return trains
    .filter(row => tab === 'all' || Boolean(row[tab]))
    .map(row => ({
      ...row,
      ...stationRowTiming(row, tab),
      status: tab === 'arrival'
        ? row.arrivalStatus : row.departureStatus || row.arrivalStatus,
      stayLabel: row.stay == null ? '—' : `${row.stay} 分钟`,
    }))
    .sort((a, b) => a.timeSeconds - b.timeSeconds || a.train.localeCompare(b.train, 'en', { numeric: true }))
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
