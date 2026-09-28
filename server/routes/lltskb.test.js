import test from 'node:test'
import assert from 'node:assert/strict'
import { zipSync } from 'fflate'
import { createLltLoader, parseLltArchive, parseLltFiles, readLltNumber } from './lltskb.js'

function dictionary(names) {
  const count = Buffer.alloc(2)
  count.writeUInt16BE(names.length)
  return Buffer.concat([count, ...names.map(name => {
    const content = Buffer.from(name)
    const length = Buffer.alloc(2)
    length.writeUInt16BE(content.length)
    return Buffer.concat([length, content])
  })])
}

function fixture() {
  const files = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`T${index}.dat`, Buffer.alloc(0)]))
  files['t.i'] = dictionary(['G1'])
  files['s.i'] = dictionary(Array.from({ length: 257 }, (_, index) => `车站${index}`))
  files['ver.txt'] = Buffer.from('20261004')
  const record = Buffer.alloc(17 + 3 * 7)
  record.writeUInt16BE(3, 15)
  // 23:58 到达、停 5 分钟，下一站为次日；索引 256 与里程 1318 均跨字节。
  record.set([0, 0, 20, 0, 0, 0, 0], 17)
  record.set([0, 1, 23, 58, 5, 4, 3], 24)
  record.set([1, 1, 1, 0, 0, 5, 43], 31)
  files['T0.dat'] = record
  return files
}

test('按 255 进制解析车次索引、站点索引和累计里程', () => {
  assert.equal(readLltNumber(Buffer.from([0x21, 0xa1]), 0), 8576)
  const data = parseLltArchive(zipSync(fixture()))
  assert.equal(data.version, '20261004')
  const stops = data.trains.get('G1').stops
  assert.equal(stops[2].station, '车站256')
  assert.deepEqual(stops.map(stop => stop.mileage), [0, 1023, 1318])
  assert.equal(stops[1].departure, '00:03')
  assert.deepEqual(stops.map(stop => stop.arrivalDay), [0, 0, 1])
})

test('拒绝损坏数据，里程倒退的记录不参与补全', () => {
  const files = fixture()
  files['T0.dat'][36] = 0
  files['T0.dat'][37] = 0
  assert.ok(parseLltFiles(files).trains.get('G1').stops.every(stop => stop.mileage === null))
  assert.throws(() => parseLltFiles({ ...fixture(), 'T0.dat': Buffer.alloc(16) }))
  assert.throws(() => parseLltFiles({ ...fixture(), 't.i': Buffer.from([0, 1, 0, 5, 65]) }))
  const badIndex = fixture()
  badIndex['T0.dat'].set([255, 255], 17)
  assert.throws(() => parseLltFiles(badIndex))
})

test('更新包下载合并并发请求、兼容 manifest 格式错误，缓存解析结果', async () => {
  let calls = 0
  const load = createLltLoader(async url => {
    calls++
    return new Response(url.endsWith('android.ver') ? '\uFEFF{"version":{"data":"20261004"},"market":[{"name": 应用宝"}]}' : zipSync(fixture()))
  })
  const [first, second] = await Promise.all([load(), load()])
  assert.equal(first, second)
  assert.equal(await load(), first)
  assert.equal(calls, 2)
})

test('版本不一致时不使用更新到一半的数据包', async () => {
  let calls = 0
  const load = createLltLoader(async url => {
    calls++
    return new Response(url.endsWith('android.ver') ? '{"version":{"data":"20261005"}}' : zipSync(fixture()))
  })
  await assert.rejects(load(), /正在更新/)
  await assert.rejects(load(), /正在更新/)
  assert.equal(calls, 2)
})
