import test from 'node:test'
import assert from 'node:assert/strict'
import { canConnectTransport } from './transportConnection.js'

const embedUrl = 'https://www.openstreetmap.org/export/embed.html?layer=transportmap'

test('在用户浏览器探测官网与交通服务，使用 no-cors 避免 CORS 误判', async () => {
  const calls = []
  const connected = await canConnectTransport(embedUrl, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return { type: 'opaque' }
    },
  })
  assert.equal(connected, true)
  assert.equal(calls[0].url, embedUrl)
  assert.equal(new URL(calls[1].url).hostname, 'api.thunderforest.com')
  assert.ok(calls.every(call => call.options.mode === 'no-cors'))
  assert.ok(calls.every(call => call.options.credentials === 'omit'))
})

test('只有官网可访问但 T 服务被阻断时仍切换备用，并取消其他请求', async () => {
  const signals = []
  const connected = await canConnectTransport(embedUrl, {
    fetchImpl: async (url, options) => {
      signals.push(options.signal)
      if (url.includes('thunderforest.com')) throw new TypeError('Failed to fetch')
      return { type: 'opaque' }
    },
  })
  assert.equal(connected, false)
  assert.ok(signals.every(signal => signal.aborted))
})

test('无法响应的连接有固定超时，离开地图也会中止探测', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const fetchImpl = (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })
  const timeout = canConnectTransport(embedUrl, { fetchImpl, timeoutMs: 100 })
  context.mock.timers.tick(100)
  assert.equal(await timeout, false)

  const controller = new AbortController()
  const canceled = canConnectTransport(embedUrl, { fetchImpl, signal: controller.signal })
  controller.abort()
  assert.equal(await canceled, false)
  let requests = 0
  assert.equal(await canConnectTransport(embedUrl, {
    signal: controller.signal,
    fetchImpl: async () => { requests++ },
  }), false)
  assert.equal(requests, 0)
})
