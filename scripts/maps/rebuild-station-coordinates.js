import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import originalCoordinates from '../../src/utils/maps/stationCoordinates.js'
import stationData from '../../src/station_name.js'
import { acceptedRailwayTypes, classifyFacility, featureCoordinates, stationAliases, normalizeName, clusterCandidates, representative, distanceKm } from './lib/railway-station-audit.js'

const root = new URL('../../', import.meta.url)
const auditRoot = new URL('data/maps/station-coordinate-audit/', root)
const readJson = async url => JSON.parse((await fs.readFile(url, 'utf8')).replace(/^\uFEFF/, ''))
const writeJson = (name, value) => fs.writeFile(new URL(name, auditRoot), `${JSON.stringify(value, null, 2)}\n`)
const roundCoordinates = value => value.map(number => Math.round(number * 1e7) / 1e7)
const simplifications = await readJson(new URL('name-simplifications.json', auditRoot))
const identitySource = await readJson(new URL('upstream/station-identifiers.json', auditRoot))
const reviewedResolutions = await readJson(new URL('reviewed-name-resolutions.json', auditRoot))
const userProvidedCoordinates = await readJson(new URL('user-provided-coordinates.json', auditRoot))
const blockedResolutions = await readJson(new URL('blocked-name-resolutions.json', auditRoot))
const baselineUrl = new URL('previous-coordinates.json.gz', auditRoot)
let baseline
try { baseline = JSON.parse(gunzipSync(await fs.readFile(baselineUrl))) } catch (error) {
  if (error.code !== 'ENOENT') throw error
  baseline = originalCoordinates
  await fs.writeFile(baselineUrl, gzipSync(JSON.stringify(baseline)))
}

const sources = []
const records = new Map()
const excluded = []
const historicalCandidates = new Map()
const indexedHistoricalIds = new Set()
function indexHistorical(element, region, classification) {
  const id = `${element.type}/${element.id}`
  if (indexedHistoricalIds.has(id) || !classification.types.some(type => acceptedRailwayTypes.has(type)) || classification.states.length !== 1) return
  indexedHistoricalIds.add(id)
  const state = classification.states[0]
  if (!['present', 'disused', 'abandoned', 'razed', 'preserved'].includes(state)) return
  const coordinates = featureCoordinates(element)
  if (!coordinates || coordinates.some(number => !Number.isFinite(number))) return
  let tags = element.tags
  if (state === 'present') {
    tags = Object.fromEntries(Object.entries(element.tags || {}).filter(([key]) => /^old_name(:.*)?$/.test(key)).map(([key, value]) => [key.replace('old_name', 'alt_name'), value]))
  }
  for (const alias of stationAliases(tags, simplifications)) {
    const candidates = historicalCandidates.get(alias.name) || []
    candidates.push({ id, osmType: element.type, osmId: element.id, coordinates: roundCoordinates(coordinates), region, state, feature: element.tags.railway || element.tags[`${state}:railway`], tags: element.tags, matchSource: state === 'present' ? alias.source.replace('alt_name', 'old_name') : alias.source })
    historicalCandidates.set(alias.name, candidates)
  }
}
const excludedById = new Map()
const excludedNameIndex = new Map()
function excludeElement(element, region, reason) {
  const id = `${element.type}/${element.id}`
  const row = { id, regions: [region], name: element.tags?.name, ...reason }
  excluded.push(row)
  excludedById.set(id, row)
  const coordinates = featureCoordinates(element)
  if (!coordinates) return
  for (const alias of stationAliases(element.tags || {}, simplifications)) {
    const matches = excludedNameIndex.get(alias.name) || []
    matches.push({ ...row, coordinates })
    excludedNameIndex.set(alias.name, matches)
  }
}
for (const region of ['CN', 'HK', 'LA']) {
  const bytes = await fs.readFile(new URL(`raw/${region}.json.gz`, auditRoot))
  const raw = JSON.parse(gunzipSync(bytes))
  const receipt = await readJson(new URL(`raw/${region}.receipt.json`, auditRoot))
  const elements = raw.elements.filter(element => element.type !== 'count')
  const counts = raw.elements.filter(element => element.type === 'count')
  if (raw.remark || counts.length !== 1 || Number(counts[0].tags.total) !== elements.length || !elements.length) {
    throw new Error(`Incomplete ${region} snapshot`)
  }
  if (createHash('sha256').update(bytes).digest('hex') !== receipt.sha256) throw new Error(`${region} snapshot checksum mismatch`)
  const timestamp = raw.osm3s.timestamp_osm_base
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error(`${region} timestamp missing`)
  sources.push({ region, endpoint: receipt.endpoint, osmTimestamp: timestamp, areaTimestamp: raw.osm3s.timestamp_areas_base, retrievedAt: receipt.retrievedAt, count: counts[0].tags, sha256: receipt.sha256 })
  for (const element of elements) {
    const id = `${element.type}/${element.id}`
    const classification = classifyFacility(element.tags)
    indexHistorical(element, region, classification)
    if (records.has(id)) { records.get(id).regions.push(region); continue }
    if (excludedById.has(id)) { excludedById.get(id).regions.push(region); continue }
    if (!classification.eligible) {
      excludeElement(element, region, classification)
      continue
    }
    const coordinates = featureCoordinates(element)
    if (!coordinates || coordinates.some(number => !Number.isFinite(number)) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 85) {
      excludeElement(element, region, { reason: 'invalid-or-incomplete-geometry' })
      continue
    }
    records.set(id, {
      id, osmType: element.type, osmId: element.id, regions: [region],
      feature: element.tags.railway, type: classification.types.includes('train') ? 'train' : 'suburban', types: classification.types, state: 'present',
      coordinates: roundCoordinates(coordinates), tags: element.tags,
      aliases: stationAliases(element.tags, simplifications)
    })
  }
}

// 用户确认的别名单独留档，不改写 OSM 原始标签；源对象仍须满足现役铁路筛选。
for (const [name, resolution] of Object.entries(reviewedResolutions)) {
  if (!resolution.aliasOf) continue
  const record = records.get(resolution.selectedId)
  if (!record || !record.aliases.some(alias => alias.name === normalizeName(resolution.aliasOf))) {
    throw new Error(`Reviewed alias does not match its source station: ${name}`)
  }
  for (const alias of stationAliases({ alt_name: `${name};${name}站;${name}火车站` })) {
    if (!record.aliases.some(existing => existing.name === alias.name)) {
      record.aliases.push({ ...alias, source: 'user-confirmed-alias' })
    }
  }
}

const nameIndex = new Map()
for (const record of records.values()) {
  for (const alias of record.aliases) {
    const candidates = nameIndex.get(alias.name) || []
    candidates.push({ ...record, matchRank: alias.rank, matchSource: alias.source })
    nameIndex.set(alias.name, candidates)
  }
}
const official = stationData.split('@').filter(Boolean).map(row => {
  const fields = row.split('|')
  return { name: fields[1], code: fields[2], city: fields[7] }
})
const officialByName = new Map(official.map(station => [station.name, station]))

function candidatesFor(name) {
  const normalized = normalizeName(name)
  let candidates = nameIndex.get(normalized) || []
  if (!candidates.length) return []
  const reviewed = reviewedResolutions[name] || reviewedResolutions[name.replace(/(?:火车站|铁路站|站)$/u, '')]
  // 已确认的别名可能与异地站的主名称相同，不能先被主名称优先规则排除。
  if (reviewed && candidates.some(candidate => candidate.id === reviewed.selectedId)) return candidates
  const officialStation = officialByName.get(name)
  if (officialStation?.city.startsWith('老挝') || officialStation?.name === '万象') {
    const laoCandidates = candidates.filter(candidate => candidate.regions.includes('LA'))
    if (laoCandidates.length) candidates = laoCandidates
  }
  const exactPrimary = candidates.filter(candidate => normalizeName(candidate.tags.name || '') === normalized)
  if (exactPrimary.length) candidates = exactPrimary
  const best = Math.max(...candidates.map(candidate => candidate.matchRank))
  // 主名称优先于别名；同级主名称冲突必须继续核查。
  return candidates.filter(candidate => candidate.matchRank >= best - 8)
}

const cityAnchors = new Map()
for (const station of official) {
  const groups = clusterCandidates(candidatesFor(station.name))
  if (groups.length !== 1 || !station.city) continue
  const anchors = cityAnchors.get(station.city) || []
  anchors.push(representative(groups[0]))
  cityAnchors.set(station.city, anchors)
}

function resolveName(name) {
  const candidates = candidatesFor(name)
  const blocked = blockedResolutions[name]
  if (blocked) return { status: 'ambiguous', candidates, evidence: blocked }
  if (!candidates.length) return { status: 'unverified', candidates: [] }
  const reviewed = reviewedResolutions[name] || reviewedResolutions[name.replace(/(?:火车站|铁路站|站)$/u, '')]
  if (reviewed) {
    const selected = candidates.find(candidate => candidate.id === reviewed.selectedId)
    if (!selected) {
      if (reviewedResolutions[name]) throw new Error(`Reviewed resolution no longer matches the snapshot: ${name}`)
      return { status: 'ambiguous', candidates }
    }
    return { status: 'resolved', reason: reviewed.matchReason || 'reviewed-station-line-identity', selected, candidates, evidence: reviewed }
  }
  const groups = clusterCandidates(candidates)
  if (groups.length === 1) {
    const officialStation = officialByName.get(name)
    const countryContext = officialStation?.city.startsWith('老挝') || officialStation?.name === '万象'
    return { status: 'resolved', reason: countryContext ? 'official-country-context' : 'unique-source-location', selected: representative(groups[0]), candidates }
  }
  const station = officialByName.get(name)
  if (station) {
    if (station.city.startsWith('老挝') || station.name === '万象') {
      const laoGroups = groups.filter(group => group.some(candidate => candidate.regions.includes('LA')))
      if (laoGroups.length === 1) return { status: 'resolved', reason: 'official-country-context', selected: representative(laoGroups[0]), candidates }
    }
    const matchesCode = candidate => Object.entries(candidate.tags).some(([key, value]) => /^(railway:ref|ref|ref:station|ref:12306|ref:cr|ref:CR)$/.test(key) && String(value).split(';').includes(station.code))
      || ['P296', 'P14874'].some(property => (identitySource.entities?.[candidate.tags.wikidata]?.claims?.[property] || []).some(claim => claim.mainsnak?.datavalue?.value === station.code))
    const codedGroups = groups.filter(group => group.some(matchesCode))
    if (codedGroups.length === 1) return { status: 'resolved', reason: 'official-telecode', selected: representative(codedGroups[0]), candidates }
    const anchors = cityAnchors.get(station.city) || []
    if (anchors.length >= 2) {
      const ranked = groups.map(group => ({ group, distance: Math.min(...group.flatMap(candidate => anchors.map(anchor => distanceKm(candidate.coordinates, anchor.coordinates)))) })).sort((a, b) => a.distance - b.distance)
      if ((ranked[0].distance <= 100 && ranked[1].distance > 250 && ranked[1].distance > ranked[0].distance * 4)
        || (anchors.length >= 3 && ranked[0].distance <= 20 && ranked[1].distance > 100 && ranked[1].distance > ranked[0].distance * 6)) {
        return { status: 'resolved', reason: 'official-city-context', selected: representative(ranked[0].group), candidates, city: station.city, anchorIds: anchors.map(anchor => anchor.id) }
      }
    }
    // 客运标记不能压过官方地域：避免将伊春“红星”错配到湖南同名站。
    const passengerGroups = groups.filter(group => group.some(candidate => ['station', 'halt'].includes(candidate.feature)
      && candidate.tags.public_transport === 'station'
      && anchors.some(anchor => distanceKm(candidate.coordinates, anchor.coordinates) <= 100)))
    if (passengerGroups.length === 1) return { status: 'resolved', reason: 'official-passenger-station', selected: representative(passengerGroups[0]), candidates }
  }
  return { status: 'ambiguous', candidates }
}

const coordinates = {}
const provenance = {}
const ambiguous = []
for (const name of [...nameIndex.keys()].sort()) {
  const resolution = resolveName(name)
  if (resolution.status !== 'resolved') {
    ambiguous.push({ name, candidates: resolution.candidates.map(candidate => ({ id: candidate.id, name: candidate.tags.name, coordinates: candidate.coordinates })) })
    continue
  }
  coordinates[name] = resolution.selected.coordinates
  provenance[name] = {
    selectedId: resolution.selected.id, sourceIds: resolution.candidates.map(candidate => candidate.id),
    reason: resolution.reason, matchSource: resolution.selected.matchSource,
    ...(resolution.evidence ? { evidence: resolution.evidence } : {}),
    ...(resolution.city ? { city: resolution.city, anchorIds: resolution.anchorIds } : {})
  }
}

// 明确提供的坐标使用独立来源，不冒充符合现役筛选条件的 OSM 对象。
for (const [station, entry] of Object.entries(userProvidedCoordinates)) {
  const value = entry.coordinates
  if (entry.source !== 'user-provided' || !Array.isArray(value) || value.length !== 2
    || !value.every(Number.isFinite) || Math.abs(value[0]) > 180 || Math.abs(value[1]) > 85) {
    throw new Error(`Invalid user-provided station coordinates: ${station}`)
  }
  for (const name of [station, ...(entry.aliases || [])]) {
    const normalized = normalizeName(name)
    coordinates[normalized] = roundCoordinates(value)
    provenance[normalized] = {
      source: 'user-provided', reason: 'user-provided-coordinates', station,
      matchSource: normalized === station ? 'user-provided-name' : 'user-provided-alias',
      evidence: entry
    }
  }
}

const historicalCoordinates = {}
const historicalProvenance = {}
for (const [name, previous] of Object.entries(baseline)) {
  const candidates = (historicalCandidates.get(normalizeName(name)) || []).filter(candidate => distanceKm(candidate.coordinates, previous) <= 3)
  const groups = clusterCandidates(candidates)
  if (groups.length !== 1) continue
  const selected = representative(groups[0])
  historicalCoordinates[name] = selected.coordinates
  historicalProvenance[name] = { selectedId: selected.id, state: selected.state, matchSource: selected.matchSource, baselineDistanceKm: Math.round(distanceKm(previous, selected.coordinates) * 1000) / 1000 }
}

const previousAudit = Object.entries(baseline).map(([name, previous]) => {
  const resolution = resolveName(name)
  const current = coordinates[name] || coordinates[normalizeName(name)]
  const distance = current ? distanceKm(previous, current) : null
  const previousExcludedEvidence = (excludedNameIndex.get(normalizeName(name)) || [])
    .filter(candidate => distanceKm(candidate.coordinates, previous) < 0.1)
    .map(({ id, types, states, reason }) => ({ id, types, states, ...(reason ? { reason } : {}) }))
  return {
    name, previous, current: current || null,
    status: !current ? historicalCoordinates[name] ? 'verified-historical-only' : resolution.status : distance > 1 ? 'corrected-over-1km' : distance > 0.05 ? 'updated-50m-to-1km' : 'verified-within-50m',
    distanceKm: distance == null ? null : Math.round(distance * 1000) / 1000,
    ...(historicalCoordinates[name] ? { historicalCoordinates: historicalCoordinates[name], historicalSource: historicalProvenance[name] } : {}),
    ...(previousExcludedEvidence.length ? { previousExcludedEvidence } : {}),
    ...(current ? { source: provenance[name] || provenance[normalizeName(name)] } : { candidates: resolution.candidates.map(candidate => ({ id: candidate.id, name: candidate.tags.name, coordinates: candidate.coordinates })) })
  }
})
const unresolvedOfficial = official.filter(station => !coordinates[station.name]).map(station => ({ ...station, ...resolveName(station.name) })).map(station => ({
  name: station.name, code: station.code, city: station.city, status: station.status,
  candidates: station.candidates.map(candidate => ({ id: candidate.id, name: candidate.tags.name, coordinates: candidate.coordinates }))
}))
const statusCounts = previousAudit.reduce((counts, row) => ({ ...counts, [row.status]: (counts[row.status] || 0) + 1 }), {})
const summary = {
  source: 'OpenStreetMap via Overpass, filtered with OpenRailwayMap train or suburban / present rules, with separately attributed user-provided coordinate supplements',
  acceptedTypes: [...acceptedRailwayTypes],
  ruleSource: 'https://github.com/hiddewie/OpenRailwayMap-vector/blob/106d97af12e5b34af8396ca898682345925dec2c/import/openrailwaymap.lua',
  license: '© OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright',
  sources, eligibleObjects: records.size,
  eligibleByType: Object.fromEntries([...acceptedRailwayTypes].map(type => [type, [...records.values()].filter(record => record.type === type).length])),
  eligibleByRegion: Object.fromEntries(['CN', 'HK', 'LA'].map(region => [region, [...records.values()].filter(record => record.regions.includes(region)).length])),
  unnamedObjects: [...records.values()].filter(record => !record.aliases.length).length,
  coordinateNames: Object.keys(coordinates).length,
  userProvidedCoordinateNames: Object.values(provenance).filter(row => row.source === 'user-provided').length,
  previousNames: Object.keys(baseline).length, previousStatusCounts: statusCounts,
  addedNames: Object.keys(coordinates).filter(name => !Object.hasOwn(baseline, name)).length,
  ambiguousNames: ambiguous.length,
  officialStations: official.length, officialMatched: official.length - unresolvedOfficial.length,
  verifiedHistoricalNames: Object.keys(historicalCoordinates).length,
  historicalFallbackNames: Object.keys(historicalCoordinates).filter(name => !coordinates[name]).length,
  unresolvedOfficial: unresolvedOfficial.length,
  excludedObjects: excluded.length,
  caveats: [
    'present follows OSM lifecycle tags; it does not independently confirm passenger service or operation on a particular date.',
    'All eligible objects, including unnamed ones and ambiguous names, are preserved in the catalog; ambiguous names are not assigned arbitrary coordinates.',
    'Unverifiable legacy/estimated coordinates are archived. Verified former train or suburban stations are available separately for historical user journeys; current train maps use present records and explicitly user-provided coordinate supplements with separate provenance.',
    'Polygons use Web Mercator geometry centroids; overlapping features within 1 km prefer a station node over an area or yard.'
  ]
}
await writeJson('summary.json', summary)
await writeJson('previous-coordinate-audit.json', previousAudit)
await writeJson('unresolved-official-stations.json', unresolvedOfficial)
await writeJson('ambiguous-names.json', ambiguous)
await writeJson('coordinate-provenance.json', provenance)
await fs.writeFile(new URL('catalog.json.gz', auditRoot), gzipSync(JSON.stringify([...records.values()])))
await fs.writeFile(new URL('excluded.json.gz', auditRoot), gzipSync(JSON.stringify(excluded)))
await writeJson('reviewed-coordinates.json', coordinates)
await writeJson('historical-coordinates.json', historicalCoordinates)
await writeJson('historical-provenance.json', historicalProvenance)
const statuses = Object.entries(statusCounts).map(([status, count]) => `| ${status} | ${count} |`).join('\n')
const corrections = previousAudit.filter(row => row.distanceKm > 1).sort((a, b) => b.distanceKm - a.distanceKm).slice(0, 20)
const report = [
  '# 铁路站点坐标核查结果',
  '',
  `已按 OpenRailwayMap 的 train 或 suburban / present 分类规则完成 CN、HK、LA 三个地域的原始对象拉取，并逐项审核原有 ${summary.previousNames} 个坐标名称。根据用户补充要求，现役城际、市郊铁路的 suburban 类型也纳入应用。`,
  '',
  '## 数据范围与完成性',
  '',
  '| 地域 | 原始对象数（含其它类型与历史状态，用于核查） | train 或 suburban/present 对象数 | OSM 源时间（UTC） |',
  '| --- | ---: | ---: | --- |',
  ...sources.map(source => `| ${source.region} | ${source.count.total} | ${summary.eligibleByRegion[source.region]} | ${source.osmTimestamp} |`),
  '',
  `按 OSM 对象 ID 去重后共有 ${summary.eligibleObjects} 个符合条件的设施。CN 范围已经覆盖 HK，因此不可把三个地域的数量直接相加。所有 ${summary.unnamedObjects} 个无名称设施也保留在完整目录中。`,
  `按优先类型统计：train ${summary.eligibleByType.train} 个、suburban ${summary.eligibleByType.suburban} 个；多类型中含 train 的设施计入 train。源标签 types 完整保留。`,
  '',
  `地图查找表支持 ${summary.coordinateNames} 个名称及别名；其中 ${summary.userProvidedCoordinateNames} 个名称使用明确的用户补充坐标，其余来自符合现役筛选的 OSM 对象。该数量不是实际车站数。官方站名索引共 ${summary.officialStations} 项，已匹配 ${summary.officialMatched} 项，尚未确认 ${summary.unresolvedOfficial} 项。`,
  '',
  '三个原始响应均检查了末尾完成计数、JSON 完整性、无运行错误 remark、SHA-256。坐标均为 WGS84，经度在前、纬度在后。',
  '',
  '## 原有坐标逐项核查',
  '',
  '| 当前审核状态 | 名称数 |',
  '| --- | ---: |',
  statuses,
  '',
  `按用户确认，另保留 ${summary.verifiedHistoricalNames} 个已核实旧站名称，其中 ${summary.historicalFallbackNames} 个补充现役查找表没有的历史名称，仅用于 /user。旧站只能来自实际 OSM 几何及现有旧名称，不生成估算坐标。`,
  '',
  '## 较大的现役坐标修正（前 20 项）',
  '',
  '| 站名 | 原坐标 [经度,纬度] | 新坐标 [经度,纬度] | 两位置距离 km | OSM 源对象 |',
  '| --- | --- | --- | ---: | --- |',
  ...corrections.map(row => `| ${row.name} | ${JSON.stringify(row.previous)} | ${JSON.stringify(row.current)} | ${row.distanceKm} | [${row.source.selectedId}](https://www.openstreetmap.org/${row.source.selectedId}) |`),
  '',
  '该距离是旧值与当前源坐标的距离，不是 OSM 自身的测量精度。逐条记录含旧值、新值、源对象、匹配依据及旧坐标匹配到的地铁/其它状态证据。',
  '',
  '## 匹配规则与限制',
  '',
  '- 按 ORM 导入代码解释 station、多交通模式标签及默认 train 类型，不要求每个车站必须写 train=yes；接受 train 和 suburban，仍排除明确只有 subway、tram 等类型的设施。',
  '- 新桥使用用户明确提供的 node/7742242697（上海金山铁路）；其余异地同名新桥保留在完整目录中。云山 node/3677430195、西湖东 node/3693383858 按 suburban/present 纳入；identity/supplement-stations.json 保存三个节点的当前 OSM API 核查响应，标签、坐标均与全量快照一致。',
  '- 常村、古城子、遥林、铁厂、桥头、青沟子、三家子使用用户指定的 OSM 节点消歧；林子头对应遥林（林头子为用户确认的笔误，已更正），该别名标记为 user-confirmed-alias，不改写 OSM 原始标签。天桥按用户更正使用凤城市 node/7527334064，不再作为古城子 node/8840528310 的别名；两站在 4317/4320、4318/4319 中分别停靠。确认依据保存在 reviewed-name-resolutions.json。',
  '- 龙池使用用户指定的 node/1681825098 消歧；大柴旦东 node/7276945325 的饮马峡旧名按用户确认加入匹配，其余未经确认的 old_name 仍不自动加入。蒋村使用用户提供的 38.532911N/113.027942E，保存于 user-provided-coordinates.json；附近 node/1668749941 的生命周期标签矛盾，不将其标记为已核实现役 OSM 对象。',
  '- 惠农南使用用户核查后指定的 node/10908472608，沙湾使用 node/1588514487，共和使用 node/1588514366；同名冲突的其他源对象继续保留。前山使用用户提供的 GeoHack 经纬度；房山东使用用户指定 node/13706600750 的坐标，该节点现役/建设中标签矛盾，按用户确认单独补入，原始分类不变。来源分别保存于 reviewed-name-resolutions.json 和 user-provided-coordinates.json。',
  '- 当前候选必须只有 present 状态；同时具有多个生命周期标签的矛盾对象留在排除清单中。present 表示地图标签状态，不能单独证明某日期有客运列车。',
  '- 名称支持简繁、多语言、站名后缀；不将站场编号截成车站名，不把 old_name 自动混入现役名称。',
  '- 同名异地站核对官方电报码、地域或已审阅的线路证据；不会用原来的错误坐标作为唯一选点依据。',
  '- 原始节点优先；面、线对象使用完整几何的 Web Mercator 中心。应用坐标不保证与 ORM 把出入口、站台聚合后的图标像素中心完全相同。',
  '- /user 优先使用现役坐标，再使用已核实旧站；同名新旧站不会自动按票据日期切换地址。',
  '- 尚未确认名称见 unresolved-official-stations.json，尚未解决的同名冲突见 ambiguous-names.json，包括原始源有重复节点的狼尾山，以及地域身份冲突的建设。已由用户确认选点的惠农南等名称的所有候选仍保留在完整目录和 coordinate-provenance.json。',
  '- identity/yuzhou.json 的 ORM 搜索响应在这次查询中把 latitude/longitude 字段的数值顺序反置；本流程只用原始 OSM lon/lat，不从该响应取坐标。',
  '',
  '## 证据文件',
  '',
  '- raw/*.json.gz：三个地域的完整原始响应；*.overpassql：确切查询；*.receipt.json：源时间、计数和校验值。',
  '- catalog.json.gz：全部符合条件的设施、源 ID、原始标签、坐标和别名；excluded.json.gz：被排除对象及原因。',
  '- previous-coordinates.json.gz：原有坐标备份；previous-coordinate-audit.json：全部原有坐标的逐项核查。',
  '- coordinate-provenance.json：每个地图查找名称的源对象或用户补充依据及匹配理由；historical-provenance.json：旧站来源。',
  '- user-provided-coordinates.json：用户明确提供的精确坐标及别名，单独标记来源；该补充不修改 OSM 原始快照或现役分类。',
  '- reviewed-name-resolutions.json：郏县、禹州的线路核查、用户指定的站点节点及别名；blocked-name-resolutions.json：仍有身份冲突的名称。',
  '- upstream/station-identifiers.json：仅用于核对站点身份的 Wikidata 标识，不从 Wikidata 取应用坐标。',
  '',
  '## 复现与更新',
  '',
  '```powershell',
  './scripts/maps/fetch-railway-stations.ps1',
  './scripts/maps/simplify-railway-names.ps1',
  'node scripts/maps/rebuild-station-coordinates.js --write',
  'node --test scripts/maps/lib/railway-station-audit.test.js src/utils/maps/stationCoordinates.test.js src/utils/maps/trainRouteMap.test.js',
  'npm run build',
  '```',
  '',
  '公共 Overpass 服务可能限流。若一个地域失败，保留已完成响应，等待服务允许查询后用 -Regions CN、HK 或 LA 单独重试；不把错误或截断响应当作全量完成。Wikidata 标识与手工核查是本次快照的证据，后续同名站变化需重新审阅。',
  '',
  `筛选定义：[ORM 导入代码](${summary.ruleSource})。源数据：[OpenStreetMap](https://www.openstreetmap.org/copyright)，© OpenStreetMap contributors，ODbL 1.0。`
].join('\n')
await fs.writeFile(new URL('report.md', auditRoot), report + '\n')

if (process.argv.includes('--write')) {
  const target = new URL('src/utils/maps/stationCoordinates.js', root)
  const source = await fs.readFile(target, 'utf8')
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const objectStart = source.indexOf('const stationCoordinates = {')
  const objectEnd = source.indexOf(`${newline}};`, objectStart)
  if (objectStart < 0 || objectEnd < 0) throw new Error('Station coordinate object boundaries not found')
  const header = [
    '// 站点经纬度坐标映射（WGS84：[经度, 纬度]）',
    '// © OpenStreetMap contributors，ODbL 1.0；按 OpenRailwayMap Type: train 或 suburban / State: present 筛选。',
    '// 用户提供的精确补充坐标单独留档，不作为 OSM 现役分类证据。',
    '// 原始数据、逐项核查及来源：data/maps/station-coordinate-audit；重建：node scripts/maps/rebuild-station-coordinates.js --write',
    ''
  ].join(newline)
  const rows = Object.entries(coordinates).map(([name, value]) => `  ${JSON.stringify(name)}: [${value.join(', ')}],`)
  const object = ['const stationCoordinates = {', ...rows, '};'].join(newline)
  const historicalRows = Object.entries(historicalCoordinates).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, value]) => `  ${JSON.stringify(name)}: [${value.join(', ')}],`)
  const historicalObject = ['// 已核实的旧站坐标，仅供历史运转轨迹使用。', 'export const historicalStationCoordinates = {', ...historicalRows, '};'].join(newline)
  const suffix = source.slice(objectEnd + newline.length + 2).replace(/(?:\r?\n)*\/\/ 已核实的旧站坐标，仅供历史运转轨迹使用。\r?\nexport const historicalStationCoordinates = \{[\s\S]*?\r?\n\};/, '')
  await fs.writeFile(target, header + object + newline + newline + historicalObject + suffix)
  console.log(`Updated ${fileURLToPath(target)}`)
}
console.log(JSON.stringify(summary, null, 2))
