export function watchTileLayer(layer, onError, timeoutMs = 10000) {
  let timer
  let disposed = false
  let reported = false

  function fail() {
    if (disposed || reported) return
    reported = true
    clearTimeout(timer)
    onError()
  }

  function startTimer() {
    if (disposed || reported) return
    clearTimeout(timer)
    timer = setTimeout(fail, timeoutMs)
  }

  const events = {
    loading: startTimer,
    tileerror: fail,
    load: () => { clearTimeout(timer) },
  }
  layer.on(events)
  startTimer()
  return () => {
    disposed = true
    clearTimeout(timer)
    layer.off(events)
  }
}
