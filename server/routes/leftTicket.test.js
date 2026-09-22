import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createLeftTicketRouter, parseTrains, validateQuery } from './leftTicket.js'
import { parseSeats } from './leftTicketSeats.js'
import { matchesDepartureTime } from '../../src/utils/trainTime.js'

const date = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
function fixture() {
  const fields = Array(56).fill('')
  Object.assign(fields, { 1: '预订', 2: 'train-id', 3: 'G1', 6: 'BJP', 7: 'SHH', 8: '08:00', 9: '12:30', 10: '04:30', 11: 'Y', 26: '无', 30: '有', 31: '5', 32: '0' })
  return { result: [fields.join('|')], map: { BJP: '北京', SHH: '上海' } }
}
test('按官网字段顺序转换席别，保留零、无和缺失的区别', () => {
  const [row] = parseTrains(fixture())
  assert.equal(row.from, '北京')
  assert.equal(row.seats.second, '>20')
  assert.equal(row.seats.first, '5')
  assert.equal(row.seats.business, '0')
  assert.equal(row.seats.standing, '0')
  assert.equal(row.seats.softSleeper, '--')
  assert.throws(() => parseTrains({ result: ['broken'], map: {} }))
  assert.throws(() => parseTrains({ result: [] }))
})
test('运行图调整车次保留状态，缺失时刻不被时间筛选隐藏', () => {
  for (const departure of ['', '--:--']) {
    const fields = fixture().result[0].split('|')
    fields[1] = '列车运行图调整,<br/>暂停发售'
    fields[8] = departure
    fields[11] = 'N'
    const [row] = parseTrains({ ...fixture(), result: [fields.join('|')] })
    assert.equal(row.status, '列车运行图调整,暂停发售')
    assert.equal(row.canBuy, false)
    assert.equal(matchesDepartureTime(row.departure, [0, 24]), true)
    assert.equal(matchesDepartureTime(row.departure, [8, 12]), true)
  }
})
test('已知出发时刻仍遵守时间范围及边界', () => {
  assert.equal(matchesDepartureTime('08:00', [8, 12]), true)
  assert.equal(matchesDepartureTime('11:59', [8, 12]), true)
  assert.equal(matchesDepartureTime('07:59', [8, 12]), false)
  assert.equal(matchesDepartureTime('12:00', [8, 12]), false)
  assert.equal(matchesDepartureTime('23:59', [0, 24]), true)
})
test('有座 21 恢复区间，无座保留实际数量，异常数据不编造数量', () => {
  const fields = fixture().result[0].split('|')
  fields[26] = '有'
  fields[39] = '9215600016M096700021O057600021O057603088'
  const seats = parseSeats(fields)
  assert.equal(seats.second, '>20')
  assert.equal(seats.standing, '88')
  assert.equal(seats.first, '5') // 明确的席别数量优先，不用不一致明细覆盖。
  fields[39] = 'O057603021'
  assert.equal(parseSeats(fields).standing, '21')
  fields[39] = 'O057600168'
  assert.equal(parseSeats(fields).second, '168')
  fields[39] = 'O057600021'
  assert.equal(parseSeats(fields).second, '>20')
  for (const detail of ['O057600005', 'broken', 'O057600168O057600168']) {
    fields[39] = detail
    assert.equal(parseSeats(fields).second, '>20')
  }
  fields[30] = ''
  fields[39] = 'O057600168'
  assert.equal(parseSeats(fields).second, '--') // 不为未提供的席别制造在售记录。
})
test('校验站码、日期和预售范围，允许起终点相同', () => {
  assert.equal(validateQuery({ from: 'BJP', to: 'SHH', date }), '')
  for (const code of ['BJP', 'WCN', 'JNK', 'ICW']) {
    assert.equal(validateQuery({ from: code, to: code, date }), '')
  }
  for (const query of [{ from: 'BAD', to: 'SHH', date }, { from: 'BAD', to: 'BAD', date },
    { from: 'BJP', to: 'SHH', date: '2026-02-30' }, { from: 'BJP', to: 'SHH', date: '2099-01-01' }]) {
    assert.ok(validateQuery(query))
  }
})
async function request(mock, query = `from=BJP&to=SHH&date=${date}`) {
  const app = express()
  app.use('/api/left-ticket', createLeftTicketRouter(mock))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/left-ticket?${query}`)
    return { status: response.status, body: await response.json() }
  } finally { await new Promise(resolve => server.close(resolve)) }
}
const init = () => new Response("var CLeftTicketUrl = 'leftTicket/queryG';", { headers: { 'Set-Cookie': 'session=test; Path=/' } })
test('环线查询向上游传递相同站码并保留同站起终点结果', async () => {
  let calls = 0
  const result = await request(async (url) => {
    if (++calls === 1) return init()
    const params = new URL(url).searchParams
    assert.equal(params.get('leftTicketDTO.from_station'), 'WCN')
    assert.equal(params.get('leftTicketDTO.to_station'), 'WCN')
    const fields = fixture().result[0].split('|')
    fields[6] = fields[7] = 'WCN'
    return Response.json({ status: true, data: { result: [fields.join('|')], map: { WCN: '武昌' } } })
  }, `from=WCN&to=WCN&date=${date}`)
  assert.equal(result.status, 200)
  assert.equal(calls, 2)
  assert.equal(result.body.trains[0].from, '武昌')
  assert.equal(result.body.trains[0].to, '武昌')
})
test('从初始化页面读取接口并跟随同源 c_url，传递查询参数和会话', async () => {
  const calls = []
  const result = await request(async (url, options) => {
    calls.push(url)
    if (calls.length === 1) return init()
    assert.match(options.headers.Cookie, /session=test/)
    if (calls.length === 2) return Response.json({ status: false, c_url: 'leftTicket/queryA' })
    return Response.json({ status: true, data: fixture() })
  })
  assert.equal(result.status, 200)
  assert.equal(result.body.trains[0].train, 'G1')
  assert.match(calls[2], /\/queryA\?/)
  assert.equal(new URL(calls[2]).searchParams.get('leftTicketDTO.from_station'), 'BJP')
})
test('拒绝外站 c_url，HTML 验证页及异常数据不当作无票', async () => {
  for (const body of [() => Response.json({ status: false, c_url: 'https://example.com' }),
    () => new Response('<html>验证</html>'), () => Response.json({ status: true, data: {} })]) {
    let calls = 0
    const result = await request(async () => ++calls === 1 ? init() : body())
    assert.equal(result.status, 502)
    assert.equal(result.body.success, false)
    assert.equal(calls, 2)
  }
})
test('参数错误时不访问上游；成功的空结果保持为空', async () => {
  const invalid = await request(() => { throw new Error('不应调用') }, 'from=BAD')
  assert.equal(invalid.status, 400)
  let calls = 0
  const empty = await request(async () => ++calls === 1 ? init() : Response.json({ status: true, data: { result: [], map: {} } }))
  assert.equal(empty.status, 200)
  assert.deepEqual(empty.body.trains, [])
})
