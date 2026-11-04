export const monitorColumns = [
  ['second', '二等座'],
  ['secondSleeper', '二等卧'],
  ['firstSleeper', '一等卧'],
  ['hardSeat', '硬座'],
  ['hardSleeper', '硬卧'],
  ['softSleeper', '软卧'],
  ['standing', '无座'],
]

// 时刻和余票均为演示模拟数据，不代表实际开行或售票情况。
export const monitorTrains = [
  {
    id: 'demo-v6061', train: 'V6061', from: '北京', to: '上海',
    departure: '11:59', arrival: '06:45', duration: '18:46', canBuy: true,
    seats: { hardSeat: '无', hardSleeper: '无', softSleeper: '无', standing: '无' },
  },
  {
    id: 'demo-d7-limited', train: 'D7', from: '北京', to: '上海',
    departure: '19:18', arrival: '07:25', duration: '12:07', canBuy: true,
    seats: { second: '10', secondSleeper: '10', firstSleeper: '10', standing: '25' },
  },
  {
    id: 'demo-n3', train: 'N3', from: '北京', to: '上海',
    departure: '20:04', arrival: '11:02', duration: '14:58', canBuy: true,
    seats: { hardSeat: '无', hardSleeper: '无', softSleeper: '无', standing: '100' },
  },
  {
    id: 'demo-d5-plenty', train: 'D5', from: '北京', to: '上海',
    departure: '21:21', arrival: '09:27', duration: '12:06', canBuy: true,
    seats: { second: '>20', secondSleeper: '>20', firstSleeper: '>20', standing: '60' },
  },
]
