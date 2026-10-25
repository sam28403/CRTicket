// 参数、校准样本、来源和限制见 docs/price-calculator.md。
const distanceBands = [
  [200, 10], [400, 20], [700, 30], [1100, 40], [1600, 50],
  [2200, 60], [2900, 70], [3700, 80], [4600, 90], [Infinity, 100],
]
const taperBands = [
  [200, 10], [500, 9], [1000, 8],
  [1500, 7], [2500, 6], [Infinity, 5],
]

export const airTypes = [
  { value: 'none', label: '非空调' },
  { value: 'ordinary', label: '普通空调' },
  { value: 'new', label: '新型空调' },
]

export const fareGrades = ['快速', '普快', '普客']

const seats = [
  { label: '硬座', soft: false, berth: 0 },
  { label: '软座', soft: true, berth: 0 },
  { label: '硬卧下铺', soft: false, berth: 7619 },
  { label: '硬卧中铺', soft: false, berth: 7033 },
  { label: '硬卧上铺', soft: false, berth: 6447 },
  { label: '软卧下铺', soft: true, berth: 11429 },
  { label: '软卧上铺', soft: true, berth: 10257 },
]

export function getPriceTrainGrade(value) {
  const train = String(value ?? '').trim().toUpperCase()
  const match = /^([ZNVY])([1-9]\d{0,3})$/.exec(train)
  if (!match) return null
  const [, prefix, digits] = match
  const number = Number(digits)
  if ((prefix === 'Z' || prefix === 'N') && number <= 1998) return '快速'
  if (prefix === 'Y' && (number <= 998 || (number >= 1001 && number <= 9998))) {
    return '快速'
  }
  if (prefix === 'V') {
    if (number <= 5998) return '快速'
    if (number >= 6001 && number <= 6998) return '普快'
    if (number >= 7001 && number <= 7998) return '普客'
    return null
  }
  return null
}

export function getFareDistance(distance, minimum = 20) {
  const km = Math.max(distance, minimum)
  let start = 0
  for (const [end, step] of distanceBands) {
    if (km <= end) {
      const midpoint = start + Math.floor((km - start - 1) / step) * step + step / 2
      return Math.max(midpoint, minimum)
    }
    start = end
  }
}

// 费率以十万分之一元表示，递减比例以十分之一表示，结果为百万分之一元。
// 全程整数运算，避免分项取整边界受浮点误差影响。
function rawFare(distance, minimum, rate) {
  const km = getFareDistance(distance, minimum)
  let previous = 0
  let total = 0
  for (const [end, factor] of taperBands) {
    total += (Math.min(km, end) - previous) * factor * rate
    if (km <= end) break
    previous = end
  }
  return total
}

function componentFare(micros, newAir) {
  const whole = Math.floor((micros + 500000) / 1000000)
  return newAir ? whole + Math.round(whole / 2) : whole
}

export function calculateOrdinaryFare({ train, air, distance }) {
  const grade = getPriceTrainGrade(train)
  if (!grade) throw new Error('请输入支持的普速车次')
  return {
    train: train.trim().toUpperCase(),
    ...calculateFareByGrade({ grade, air, distance }),
  }
}

export function calculateFareByGrade({ grade, air, distance }) {
  if (!fareGrades.includes(grade)) throw new Error('请选择计价等级')
  if (!airTypes.some(type => type.value === air)) throw new Error('请选择空调类型')
  if (!Number.isInteger(distance) || distance < 1 || distance > 10000) {
    throw new Error('请输入 1 至 10000 的整数里程')
  }

  const newAir = air === 'new'
  const component = micros => componentFare(micros, newAir)
  // 按历史含保险基数确定客票档位，最后再扣减保险；并非另收现行保险费。
  const insuranceJiao = Math.ceil(rawFare(distance, 20, 5861) / 5000000)
  const insuranceMicros = insuranceJiao * 100000
  const insuranceDeduction = Math.ceil(insuranceJiao / 5) / 2
  const speedFactor = { '普客': 0, '普快': 1, '快速': 2 }[grade]
  const speed = component(rawFare(distance, 100, 1172)) * speedFactor
  const cooling = air === 'none' ? 0 : component(rawFare(distance, 20, 1465))

  return {
    grade,
    air: airTypes.find(type => type.value === air).label,
    distance,
    fares: seats.map(seat => {
      const ticket = component(rawFare(distance, 20, seat.soft ? 11722 : 5861) + insuranceMicros)
      const berth = seat.berth ? component(rawFare(distance, 400, seat.berth)) : 0
      const ticketFee = ticket > 5 ? 1 : 0.5
      const waitingFee = !seat.soft && distance > 200 ? 1 : 0
      const berthFee = seat.berth ? 10 : 0
      return {
        seat: seat.label,
        price: ticket + speed + cooling + berth + ticketFee + waitingFee
          + berthFee - insuranceDeduction,
      }
    }),
  }
}
