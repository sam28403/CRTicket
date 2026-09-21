// 本地余票解析器。依据官网 queryLeftTicket_end_js.js 的 cN / e / bI：
// result[39] (yp_info_new) 每 10 位一组：席别 1 位、票价 5 位、余票编码 4 位。
// 余票编码 >= 3000 表示无座。接口对部分有票席别返回 0021，不能当作精确的 21 张。
// 来源：https://kyfw.12306.cn/otn/resources/merged/queryLeftTicket_end_js.js
// 核对日期：2026-09-21。只解析服务端已经公开返回的数据，不执行远程脚本。
const fieldsBySeat = { business: 32, premium: 25, first: 31, second: 30, advancedSleeper: 21,
  softSleeper: 23, hardSleeper: 28, softSeat: 24, hardSeat: 29, standing: 26, other: 22, premiumSleeper: 20 }
const keysByCode = { '9': 'business', P: 'premium', M: 'first', O: 'second', S: 'second',
  '6': 'advancedSleeper', A: 'advancedSleeper', '4': 'softSleeper', I: 'softSleeper', F: 'softSleeper',
  '3': 'hardSleeper', J: 'hardSleeper', '2': 'softSeat', '1': 'hardSeat', D: 'premiumSleeper' }

export function parseSeats(fields) {
  const seats = Object.fromEntries(Object.entries(fieldsBySeat).map(([key, index]) => [key, fields[index] || '--']))
  const candidates = new Map()
  const detail = fields[39] || ''
  if (detail.length % 10 === 0 && /^(?:[A-Z0-9]\d{9})*$/.test(detail)) {
    for (let offset = 0; offset < detail.length; offset += 10) {
      const part = detail.slice(offset, offset + 10)
      const encoded = Number(part.slice(6))
      const key = encoded >= 3000 ? 'standing' : keysByCode[part[0]]
      if (!key) continue // 不把未知席别合并成一个未经核实的总数。
      const counts = candidates.get(key) || []
      counts.push(encoded >= 3000 ? encoded - 3000 : encoded)
      candidates.set(key, counts)
    }
  }
  for (const [key, raw] of Object.entries(seats)) {
    if (raw === '无') seats[key] = '0'
    if (raw !== '有') continue
    const counts = candidates.get(key)
    // 有座明细的 21 是截断值；无座保留接口的实际数量。
    // 多条同席别记录不求和；与“有”矛盾的明细和缺失数据仍保留区间。
    seats[key] = counts?.length === 1 && counts[0] >= 21 && (key === 'standing' || counts[0] !== 21) && counts[0] < 3000 ? String(counts[0]) : '>20'
  }
  return seats
}
