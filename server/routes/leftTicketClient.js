const origin = 'https://kyfw.12306.cn'

export async function queryLeftTicketData(query, fetchImpl = fetch) {
  const signal = AbortSignal.timeout(20000)
  const headers = {
    Referer: `${origin}/otn/leftTicket/init`,
    'User-Agent': 'Mozilla/5.0',
    Accept: 'application/json',
  }
  const init = await fetchImpl(`${origin}/otn/leftTicket/init`, {
    headers, signal, redirect: 'error',
  })
  if (!init.ok) throw new Error(`12306 初始化失败（HTTP ${init.status}）`)
  const html = await init.text()
  let path = html.match(/CLeftTicketUrl\s*=\s*['"](leftTicket\/query[A-Za-z]*)['"]/)?.[1]
  if (!path) throw new Error('无法识别 12306 查询接口，官网可能需要验证或已更新')
  const cookies = init.headers.getSetCookie?.().map(value => value.split(';')[0]).join('; ')
  if (cookies) headers.Cookie = cookies
  const params = new URLSearchParams({
    'leftTicketDTO.train_date': query.date,
    'leftTicketDTO.from_station': query.from,
    'leftTicketDTO.to_station': query.to,
    purpose_codes: 'ADULT',
  })
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetchImpl(`${origin}/otn/${path}?${params}`, {
      headers, signal, redirect: 'error',
    })
    if (!response.ok) throw new Error(`12306 查询失败（HTTP ${response.status}），请稍后重试或访问官网`)
    let body
    try {
      body = await response.json()
    } catch {
      throw new Error('12306 未返回余票数据，可能需要官网验证，请稍后重试')
    }
    if (body.status === true) return { data: body.data, headers }
    if (attempt === 0 && /^leftTicket\/query[A-Za-z]*$/.test(body.c_url)) {
      path = body.c_url
      continue
    }
    throw new Error('12306 暂未提供余票数据，请检查预售日期或在官网查询')
  }
}

export async function queryTicketPrices(fields, date, headers, fetchImpl = fetch) {
  const params = new URLSearchParams({
    train_no: fields[2],
    from_station_no: fields[16],
    to_station_no: fields[17],
    seat_types: fields[35],
    train_date: date,
  })
  const response = await fetchImpl(`${origin}/otn/leftTicket/queryTicketPrice?${params}`, {
    headers,
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  })
  if (!response.ok) throw new Error('12306 票价查询失败')
  const body = await response.json()
  if (body.status !== true || !body.data || typeof body.data !== 'object') {
    throw new Error('12306 未提供有效票价')
  }
  return body.data
}
