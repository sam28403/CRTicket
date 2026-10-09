import stationCoordinates from './stationCoordinates.js'

export function buildTrainRouteData(stops, coordinates = stationCoordinates) {
  const points = []
  const lines = []
  const missingStations = []
  let previous = null

  stops.forEach((stop, index) => {
    const name = String(stop.station || '').trim()
    const value = coordinates[name]
    if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) {
      missingStations.push(name || `第 ${index + 1} 站`)
      previous = null
      return
    }

    points.push({
      name,
      value,
      no: stop.no || index + 1,
      arrival: stop.arrival,
      departure: stop.departure,
      arrivalDay: stop.arrivalDay,
      isFirst: index === 0,
      isLast: index === stops.length - 1
    })
    if (previous) lines.push({ coords: [previous, value] })
    previous = value
  })

  return { points, lines, missingStations }
}

export function trainRouteViewport(points, width, height) {
  if (!points.length) return {}
  const longitudes = points.map(point => point.value[0])
  const latitudes = points.map(point => point.value[1])
  const minLongitude = Math.min(...longitudes)
  const maxLongitude = Math.max(...longitudes)
  const minLatitude = Math.min(...latitudes)
  const maxLatitude = Math.max(...latitudes)
  const center = [(minLongitude + maxLongitude) / 2, (minLatitude + maxLatitude) / 2]
  // 为站点标签留白，并按容器比例适配横向、纵向以及单站线路。
  let longitudeSpan = Math.max(maxLongitude - minLongitude, 0.2) * 1.5
  let latitudeSpan = Math.max(maxLatitude - minLatitude, 0.2) * 1.5
  const aspect = Math.max(width - 48, 1) / Math.max(height - 84, 1)
  const aspectScale = 0.75
  longitudeSpan = Math.max(longitudeSpan, latitudeSpan * aspect / aspectScale)
  latitudeSpan = Math.max(latitudeSpan, longitudeSpan * aspectScale / aspect)

  return {
    left: 24,
    right: 24,
    top: 60,
    bottom: 24,
    aspectScale,
    center,
    zoom: 1,
    boundingCoords: [
      [center[0] - longitudeSpan / 2, center[1] - latitudeSpan / 2],
      [center[0] + longitudeSpan / 2, center[1] + latitudeSpan / 2]
    ]
  }
}
