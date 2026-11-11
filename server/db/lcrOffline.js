import { readFile, stat } from 'node:fs/promises'

const path = new URL('./lcr-offline.json', import.meta.url)
let cached
let modified

export async function loadLcrOfflineDatabase() {
  const { mtimeMs } = await stat(path)
  if (cached && modified === mtimeMs) return cached
  const data = JSON.parse(await readFile(path, 'utf8'))
  if (data.timeZone !== 'beijing' || !Array.isArray(data.trains) || !Number.isFinite(Date.parse(data.checkedAt))) {
    throw new Error('老中铁路离线时刻表格式异常')
  }
  cached = {
    version: data.checkedAt.slice(0, 10).replaceAll('-', ''),
    trains: new Map(data.trains.map((item, index) => [`${item.train}-${index}`, item])),
  }
  modified = mtimeMs
  return cached
}
