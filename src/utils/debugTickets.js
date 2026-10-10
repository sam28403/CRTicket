import { DEFAULT_TICKET_MESSAGE, themeOptions } from './ticketShared.js'

const themes = themeOptions.filter(theme => !theme.disabled).map(theme => theme.id)
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
export const randomChoice = items => items[randomInt(0, items.length - 1)]

function seatNumber(seatType) {
  const car = String(randomInt(1, 16)).padStart(2, '0')
  if (seatType === '无座') return `${car}车无座`
  if (['二等座', '一等座', '商务座', '特等座'].includes(seatType)) {
    const letters = seatType === '二等座' ? ['A', 'B', 'C', 'D', 'F']
      : seatType === '一等座' ? ['A', 'C', 'D', 'F'] : ['A', 'C', 'F']
    const row = String(randomInt(1, seatType === '商务座' ? 5 : 20)).padStart(2, '0')
    return `${car}车${row}${randomChoice(letters)}号`
  }
  const maximum = seatType.includes('卧') ? 36 : 118
  return `${car}车${String(randomInt(1, maximum)).padStart(3, '0')}号`
}

export function buildDebugTicket(sample) {
  if (!sample?.fares?.length) throw new Error('真实车票缺少席别与票价')
  const fare = randomChoice(sample.fares)
  const [year, month, day] = sample.date.split('-')
  return {
    ...sample,
    number: `${String.fromCharCode(65 + randomInt(0, 25))}${String(randomInt(0, 999999999)).padStart(9, '0')}`,
    date: `${year}年${month}月${day}日`,
    price: fare.price,
    seatType: fare.seatType,
    finalSeatType: fare.seatType,
    // 公开接口未提供空调标记，不添加未经核实的“新空调”字样。
    hasConditioner: 0,
    seatNo: seatNumber(fare.seatType),
    sellPlace: '网',
    gate: '',
    message: DEFAULT_TICKET_MESSAGE,
    theme: randomChoice(themes),
    useCredit: 0,
  }
}
