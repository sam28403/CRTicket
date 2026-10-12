// 官方 iframe 内的瓦片事件不可跨域读取；在用户浏览器探测两个必需服务的连通性。
export async function canConnectTransport(embedUrl, {
  signal,
  timeoutMs = 6000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!embedUrl || signal?.aborted) return false
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, timeoutMs)

  try {
    await Promise.all([
      embedUrl,
      'https://api.thunderforest.com/styles/transport/style.json',
    ].map(url => fetchImpl(url, {
      mode: 'no-cors',
      credentials: 'omit',
      signal: controller.signal,
    })))
    // no-cors 的 opaque 响应只证明服务可连接，不证明 iframe 内部瓦片已渲染。
    return !controller.signal.aborted
  } catch {
    return false
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    controller.abort()
  }
}
