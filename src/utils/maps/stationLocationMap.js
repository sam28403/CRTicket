import stationCoordinates from './stationCoordinates.js'
import { normalizeStationName } from '../stationName.js'

export function stationMapLocation(station, coordinates = stationCoordinates) {
  const name = String(station || '').trim()
  const value = [name, normalizeStationName(name)]
    .filter(key => Object.hasOwn(coordinates, key))
    .map(key => coordinates[key])[0]

  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) return null
  const [longitude, latitude] = value
  if (Math.abs(longitude) > 180 || Math.abs(latitude) > 85.05112878) return null
  return [latitude, longitude]
}

export function stationMapEmbedUrl(station) {
  const location = stationMapLocation(station)
  if (!location) return ''
  const [latitude, longitude] = location
  const bounds = [
    Math.max(-180, longitude - 0.02),
    Math.max(-85.05112878, latitude - 0.01),
    Math.min(180, longitude + 0.02),
    Math.min(85.05112878, latitude + 0.01),
  ]
  const url = new URL('https://www.openstreetmap.org/export/embed.html')
  url.searchParams.set('bbox', bounds.join(','))
  // 官网的 T 交通图层在嵌入页面中使用 transportmap 标识。
  url.searchParams.set('layer', 'transportmap')
  url.searchParams.set('marker', location.join(','))
  return url.toString()
}

export function stationFallbackTiles(mirrorUrl = '') {
  return {
    // HOT 在当前中国网络可直连，中日韩文字正常；osmfr 的栅格标签存在缺字。
    url: mirrorUrl || 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    options: {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        + (mirrorUrl ? '' : ' &middot; <a href="https://www.hotosm.org/">HOT</a>'
          + ' &middot; <a href="https://www.openstreetmap.fr/">OSM France</a>'),
    },
  }
}
