export const facilityTypes = new Set(['station', 'halt', 'tram_stop', 'service_station', 'yard', 'junction', 'spur_junction', 'crossover', 'site'])
export const acceptedRailwayTypes = new Set(['train', 'suburban'])
const vehicles = ['train', 'subway', 'light_rail', 'tram', 'monorail', 'funicular', 'miniature']
const lifecycleStates = ['construction', 'proposed', 'disused', 'abandoned', 'preserved', 'razed']

export function classifyFacility(tags = {}) {
  const states = []
  if (facilityTypes.has(tags.railway)) states.push('present')
  for (const state of lifecycleStates) if (facilityTypes.has(tags[`${state}:railway`])) states.push(state)
  const types = tags.station
    ? tags.station.split(';').map(type => type.trim()).filter(Boolean)
    : vehicles.filter(vehicle => tags[vehicle] === 'yes')
  if (!types.length) types.push(tags.railway === 'tram_stop' ? 'tram' : 'train')
  return { states, types, eligible: states.length === 1 && states[0] === 'present' && types.some(type => acceptedRailwayTypes.has(type)) }
}

export function distanceKm(a, b) {
  const radians = value => value * Math.PI / 180
  const latitude = radians(b[1] - a[1])
  const longitude = radians(b[0] - a[0])
  const h = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(longitude / 2) ** 2
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}

const project = point => [point.lon * Math.PI / 180, Math.log(Math.tan(Math.PI / 4 + point.lat * Math.PI / 360))]
const unproject = point => [point[0] * 180 / Math.PI, (2 * Math.atan(Math.exp(point[1])) - Math.PI / 2) * 180 / Math.PI]
const equal = (a, b) => a && b && a.lon === b.lon && a.lat === b.lat

function ringCentroid(geometry) {
  const origin = project(geometry[0])
  const points = geometry.map(point => {
    const projected = project(point)
    return [projected[0] - origin[0], projected[1] - origin[1]]
  })
  let twiceArea = 0
  let x = 0
  let y = 0
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index]
    const b = points[index + 1]
    const cross = a[0] * b[1] - b[0] * a[1]
    twiceArea += cross
    x += (a[0] + b[0]) * cross
    y += (a[1] + b[1]) * cross
  }
  if (Math.abs(twiceArea) < 1e-15) return null
  return { center: [origin[0] + x / (3 * twiceArea), origin[1] + y / (3 * twiceArea)], weight: Math.abs(twiceArea) / 2 }
}

function lineCentroid(geometry) {
  const points = geometry.map(project)
  let weight = 0
  let x = 0
  let y = 0
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]
    const b = points[index]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    weight += length
    x += (a[0] + b[0]) / 2 * length
    y += (a[1] + b[1]) / 2 * length
  }
  return weight ? { center: [x / weight, y / weight], weight } : null
}

function joinRings(parts) {
  const remaining = parts.map(part => [...part])
  const rings = []
  while (remaining.length) {
    const ring = remaining.shift()
    while (!equal(ring[0], ring.at(-1))) {
      const index = remaining.findIndex(part => equal(ring.at(-1), part[0]) || equal(ring.at(-1), part.at(-1)))
      if (index < 0) return null
      const part = remaining.splice(index, 1)[0]
      if (!equal(ring.at(-1), part[0])) part.reverse()
      ring.push(...part.slice(1))
    }
    rings.push(ring)
  }
  return rings
}

export function featureCoordinates(element) {
  if (element.type === 'node') return Number.isFinite(element.lon) && Number.isFinite(element.lat) ? [element.lon, element.lat] : null
  if (element.type === 'way') {
    const geometry = element.geometry
    if (!geometry?.length || geometry.some(point => !point || !Number.isFinite(point.lon) || !Number.isFinite(point.lat))) return null
    const centroid = equal(geometry[0], geometry.at(-1)) ? ringCentroid(geometry) : lineCentroid(geometry)
    return centroid ? unproject(centroid.center) : null
  }
  if (element.type !== 'relation' || element.tags?.type !== 'multipolygon') return null
  let weight = 0
  let x = 0
  let y = 0
  for (const role of ['outer', 'inner']) {
    const parts = (element.members || []).filter(member => member.type === 'way' && (member.role || 'outer') === role).map(member => member.geometry)
    if (parts.some(part => !part?.length || part.some(point => !point))) return null
    const rings = joinRings(parts)
    if (!rings) return null
    for (const ring of rings) {
      const centroid = ringCentroid(ring)
      if (!centroid) return null
      const signedWeight = centroid.weight * (role === 'outer' ? 1 : -1)
      weight += signedWeight
      x += centroid.center[0] * signedWeight
      y += centroid.center[1] * signedWeight
    }
  }
  return weight > 0 ? unproject([x / weight, y / weight]) : null
}

export const normalizeName = name => String(name).normalize('NFKC').replace(/\s+/g, ' ').trim()

export function stationAliases(tags, simplifications = {}) {
  const aliases = new Map()
  const add = (name, rank, source) => {
    const normalized = normalizeName(name)
    if (!normalized || normalized.includes('\uFFFD')) return
    const previous = aliases.get(normalized)
    if (!previous || previous.rank < rank) aliases.set(normalized, { name: normalized, rank, source })
  }
  for (const [tag, value] of Object.entries(tags)) {
    if (!/^(name|official_name|short_name|alt_name|full_name|long_name|int_name)(:.*)?$/.test(tag)) continue
    const rank = tag === 'name:zh-Hans' ? 100 : tag === 'name:zh' ? 99 : tag === 'name' ? 98 : tag.startsWith('alt_name') ? 70 : 90
    for (const part of String(value).split(';')) {
      for (const [variant, penalty] of [[part, 0], [simplifications[part], 1]]) {
        if (!variant) continue
        add(variant, rank - penalty, tag)
        // 只拆真正以空白分隔的多语言名称，不把“北京西II场”截成“北京西”。
        const chineseParts = /[^\p{Script=Han}\d#·()（）\-\s]/u.test(variant)
          ? variant.split(/\s+/).filter(part => /^[\p{Script=Han}\d#·()（）\-]+$/u.test(part) && /\p{Script=Han}{2}/u.test(part))
          : []
        for (const chinese of chineseParts) add(chinese, rank - penalty - 2, `${tag}:bilingual`)
        for (const label of [variant, ...chineseParts]) {
          const short = label.replace(/(?:火车站|火車站|铁路站|鐵路站|高铁站|高鐵站|站)$/u, '')
          if (short !== label) add(short, rank - penalty - 3, `${tag}:suffix`)
        }
      }
    }
  }
  return [...aliases.values()]
}

export function clusterCandidates(candidates, radiusKm = 1) {
  const clusters = []
  for (const candidate of candidates) {
    // 不通过链式连接把不同地点逐步合并：同一组内任意两点均需接近。
    const group = clusters.find(cluster => cluster.every(other => distanceKm(candidate.coordinates, other.coordinates) <= radiusKm))
    if (group) group.push(candidate)
    else clusters.push([candidate])
  }
  return clusters
}

export function representative(candidates) {
  const score = candidate => (candidate.feature === 'station' ? 40 : candidate.feature === 'halt' ? 35 : 0)
    + (candidate.osmType === 'node' ? 20 : 0)
    + (candidate.tags.public_transport === 'station' ? 10 : 0)
    + (candidate.tags.train === 'yes' ? 5 : 0)
    + (candidate.tags.wikidata ? 3 : 0)
  return [...candidates].sort((a, b) => score(b) - score(a) || a.osmId - b.osmId)[0]
}
