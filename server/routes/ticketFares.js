import { parseSeats } from './leftTicketSeats.js'
import { isKnownSeat } from '../../src/utils/seatAvailability.js'

// 对照 12306 queryLeftTicket_end_js.js 的 e / bI / aV（2026-10-10）。
// 明细每组 10 位：席别、以角计价的 5 位金额、4 位余票编码。
const seatCodes = {
  '9': ['商务座', 'business', 'A9'],
  P: ['特等座', 'premium', 'P'],
  M: ['一等座', 'first', 'M'],
  O: ['二等座', 'second', 'O'],
  S: ['二等包座', 'second', 'S'],
  '6': ['高级软卧', 'advancedSleeper', 'A6'],
  A: ['高级动卧', 'advancedSleeper', 'A'],
  '4': ['软卧', 'softSleeper', 'A4'],
  I: ['一等卧', 'softSleeper', 'I'],
  F: ['动卧', 'softSleeper', 'F'],
  '3': ['硬卧', 'hardSleeper', 'A3'],
  J: ['二等卧', 'hardSleeper', 'J'],
  '2': ['软座', 'softSeat', 'A2'],
  '1': ['硬座', 'hardSeat', 'A1'],
}

function publishedPrice(value) {
  const match = typeof value === 'string'
    ? /^(?:[¥￥]|&yen;)\s*(\d+(?:\.\d{1,2})?)$/.exec(value)
    : null
  const price = match ? Number(match[1]) : null
  return price > 0 ? price : null
}

export function parseTicketFares(fields, prices = {}) {
  const seats = parseSeats(fields)
  const fares = new Map()
  const detail = fields[39] || ''
  if (detail && /^(?:[A-Z0-9]\d{9})+$/.test(detail)) {
    for (let offset = 0; offset < detail.length; offset += 10) {
      const part = detail.slice(offset, offset + 10)
      const standing = Number(part.slice(6)) >= 3000
      const config = seatCodes[part[0]]
      if (!config) continue
      const [label, key] = standing ? ['无座', 'standing'] : config
      const price = Number(part.slice(1, 6)) / 10
      if (!isKnownSeat(seats[key]) || price <= 0) continue
      // 同席别出现多个报价时无法确认具体铺位，不能擅自取最低价。
      const previous = fares.get(label)
      fares.set(label, previous && previous.price !== price
        ? { seatType: label, price: null }
        : previous || { seatType: label, price })
    }
  }
  // 仅对明确公布的席别补查，不将数字原始字段误当作元。
  for (const [code, [label, key, priceKey]] of Object.entries(seatCodes)) {
    if (!fields[35]?.includes(code) || !isKnownSeat(seats[key]) || fares.has(label)) continue
    const price = publishedPrice(prices[priceKey])
    if (price != null) fares.set(label, { seatType: label, price })
  }
  const standingPrice = publishedPrice(prices.WZ)
  if (!fares.has('无座') && isKnownSeat(seats.standing) && standingPrice != null) {
    fares.set('无座', { seatType: '无座', price: standingPrice })
  }
  return [...fares.values()].filter(fare => fare.price != null)
}
