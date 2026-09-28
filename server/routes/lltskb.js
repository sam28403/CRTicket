import { unzipSync } from 'fflate'

const base = 'http://down.lltskb.com'
const maxArchiveBytes = 16 * 1024 * 1024
const maxFileBytes = 4 * 1024 * 1024

// an.db 的字典长度是标准大端整数；T*.dat 的索引、里程使用 255 进制。
// 实测 20261004 包的 18783 条车次，全部车次及站点索引均能对应字典。
export function readLltNumber(buffer, offset) {
  return buffer[offset] * 255 + buffer[offset + 1]
}

function readNames(bytes) {
  if (!bytes) throw new Error('路路通数据缺少索引')
  const buffer = Buffer.from(bytes)
  const count = buffer.readUInt16BE(0)
  const names = []
  let offset = 2
  for (let i = 0; i < count; i++) {
    const length = buffer.readUInt16BE(offset)
    offset += 2
    if (!length || offset + length > buffer.length) throw new Error('路路通索引格式异常')
    names.push(buffer.toString('utf8', offset, offset + length))
    offset += length
  }
  if (offset !== buffer.length) throw new Error('路路通索引长度不一致')
  return names
}

export function parseLltFiles(files) {
  const trainNames = readNames(files['t.i'])
  const stationNames = readNames(files['s.i'])
  const version = Buffer.from(files['ver.txt'] || []).toString('utf8').trim()
  if (!/^\d{8}$/.test(version)) throw new Error('路路通数据版本无效')
  const trains = new Map()
  for (let file = 0; file < 20; file++) {
    if (!files[`T${file}.dat`]) throw new Error('路路通车次数据不完整')
    const buffer = Buffer.from(files[`T${file}.dat`])
    let offset = 0
    while (offset < buffer.length) {
      if (offset + 17 > buffer.length) throw new Error('路路通车次记录被截断')
      const train = trainNames[readLltNumber(buffer, offset)]
      const count = buffer.readUInt16BE(offset + 15)
      offset += 17
      if (!train || trains.has(train) || !count || offset + count * 7 > buffer.length) throw new Error('路路通车次索引异常')
      const stops = []
      let previousMileage = -1
      let validMileage = true
      let day = 0
      let previousDeparture = null
      for (let i = 0; i < count; i++, offset += 7) {
        const station = stationNames[readLltNumber(buffer, offset)]
        const hour = buffer[offset + 2]
        const minute = buffer[offset + 3]
        const stay = buffer[offset + 4]
        const mileage = readLltNumber(buffer, offset + 5)
        if (!station || hour > 23 || minute > 59) throw new Error('路路通车站记录异常')
        if (mileage < previousMileage || (i === 0 && mileage !== 0)) validMileage = false
        previousMileage = mileage
        const arrivalMinutes = hour * 60 + minute
        if (previousDeparture != null && arrivalMinutes < previousDeparture) day++
        const arrivalDay = day
        const departureMinutes = arrivalMinutes + stay
        day += Math.floor(departureMinutes / 1440)
        previousDeparture = departureMinutes % 1440
        const clock = value => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
        stops.push({ no: String(i + 1).padStart(2, '0'), train, station,
          arrival: i === 0 ? null : clock(arrivalMinutes),
          departure: i === count - 1 ? null : clock(departureMinutes),
          stay: i === 0 || i === count - 1 ? null : stay, arrivalDay, mileage })
      }
      // 个别记录的里程中途归零，整条记录不用于补全。
      if (!validMileage) stops.forEach(stop => { stop.mileage = null })
      trains.set(train, { train, stops })
    }
  }
  if (trains.size !== trainNames.length) throw new Error('路路通车次字典与记录数量不一致')
  return { version, trains }
}

export function parseLltArchive(bytes) {
  if (bytes.byteLength > maxArchiveBytes) throw new Error('路路通数据包过大')
  const files = unzipSync(bytes, { filter: entry => {
    if (!/^(?:[st]\.i|ver\.txt|T\d{1,2}\.dat)$/.test(entry.name)) return false
    if (entry.originalSize > maxFileBytes) throw new Error('路路通数据文件过大')
    return true
  } })
  return parseLltFiles(files)
}

async function readResponse(response) {
  if (!response.ok) throw new Error('路路通数据下载失败')
  if (Number(response.headers.get('content-length')) > maxArchiveBytes) throw new Error('路路通数据包过大')
  const chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > maxArchiveBytes) throw new Error('路路通数据包过大')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export function createLltLoader(fetchImpl = fetch) {
  let cached
  let pending
  let refreshAt = 0
  let failure
  return async function load() {
    if (Date.now() < refreshAt) {
      if (failure) throw failure
      return cached
    }
    if (pending) return pending
    pending = (async () => {
      const options = { signal: AbortSignal.timeout(15000), redirect: 'error' }
      try {
        const manifest = (await readResponse(await fetchImpl(`${base}/android.ver`, options))).toString('utf8')
          .replace(/^\uFEFF/, '').replace('"name": 应用宝"', '"name": "应用宝"')
        const version = JSON.parse(manifest).version?.data
        if (typeof version !== 'string' || !/^\d{8}$/.test(version)) throw new Error('路路通版本响应异常')
        if (cached?.version !== version) {
          const archive = await readResponse(await fetchImpl(`${base}/an.db`, options))
          const next = parseLltArchive(archive)
          if (next.version !== version) throw new Error('路路通正在更新数据，请稍后重试')
          cached = next
        }
        failure = null
        refreshAt = Date.now() + 3600000
        return cached
      } catch (error) {
        failure = error
        refreshAt = Date.now() + 60000
        throw error
      } finally { pending = null }
    })()
    return pending
  }
}

export const loadLltDatabase = createLltLoader()
