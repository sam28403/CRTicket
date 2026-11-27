import { splitTrainRecord } from '../../src/utils/trainQueryRecord.js'

// xw.dat 每条记录包含车次索引、两字节属性和分段数，每段包含累计里程及车次分量索引。
export function applyLltTrainSegments(bytes, trainNames, trains, readNumber) {
  if (!bytes || bytes.length < 2) return
  const records = new Map()
  const count = readNumber(bytes, 0)
  let offset = 2
  for (let i = 0; i < count; i++) {
    if (offset + 5 > bytes.length) return
    const train = trainNames[readNumber(bytes, offset)]
    const size = bytes[offset + 4]
    offset += 5
    if (!train || records.has(train) || offset + size * 3 > bytes.length) return

    const segments = []
    for (let j = 0; j < size; j++, offset += 3) {
      segments.push({ mileage: readNumber(bytes, offset), codeIndex: bytes[offset + 2] })
    }
    records.set(train, segments)
  }
  // 完整读取可选分段表后才更新停站，避免截断数据只更新部分车次。
  if (offset !== bytes.length) return

  for (const [train, segments] of records) {
    const item = trains.get(train)
    const codes = splitTrainRecord(train)
    if (!item || codes.length < 2 || segments[0]?.mileage !== 0) continue
    const lastMileage = item.stops.at(-1).mileage
    if (item.stops.some(stop => stop.mileage == null) || segments.some((segment, index) =>
      !codes[segment.codeIndex] || segment.mileage > lastMileage
      || (index > 0 && segment.mileage <= segments[index - 1].mileage)
    )) continue

    for (const stop of item.stops) {
      const arrival = segments.findLast(segment => segment.mileage < stop.mileage) || segments[0]
      const departure = segments.findLast(segment => segment.mileage <= stop.mileage)
      stop.arrivalTrain = codes[arrival.codeIndex]
      stop.departureTrain = codes[departure.codeIndex]
      stop.train = stop.departure ? stop.departureTrain : stop.arrivalTrain
    }
  }
}
