import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import coordinates, { historicalStationCoordinates } from './stationCoordinates.js'
import { acceptedRailwayTypes, classifyFacility, featureCoordinates } from '../../../scripts/maps/lib/railway-station-audit.js'

const auditRoot = new URL('../../../data/maps/station-coordinate-audit/', import.meta.url)
const json = async name => JSON.parse(await readFile(new URL(name, auditRoot), 'utf8'))
const catalog = JSON.parse(gunzipSync(await readFile(new URL('catalog.json.gz', auditRoot))))
const records = new Map(catalog.map(record => [record.id, record]))
const provenance = await json('coordinate-provenance.json')
const summary = await json('summary.json')
const rawById = new Map()
for (const region of ['CN', 'HK', 'LA']) {
  const raw = JSON.parse(gunzipSync(await readFile(new URL(`raw/${region}.json.gz`, auditRoot))))
  for (const element of raw.elements.filter(element => element.type !== 'count')) rawById.set(`${element.type}/${element.id}`, element)
}

test('三个地域的原始响应均有完整计数和校验值，所有符合条件对象均进入目录', async () => {
  for (const region of ['CN', 'HK', 'LA']) {
    const bytes = await readFile(new URL(`raw/${region}.json.gz`, auditRoot))
    const raw = JSON.parse(gunzipSync(bytes))
    const receipt = await json(`raw/${region}.receipt.json`)
    assert.equal(raw.remark, undefined)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256)
    const elements = raw.elements.filter(element => element.type !== 'count')
    assert.equal(Number(raw.elements.find(element => element.type === 'count').tags.total), elements.length)
    for (const element of elements) {
      const id = `${element.type}/${element.id}`
      rawById.set(id, element)
      if (classifyFacility(element.tags).eligible && featureCoordinates(element)) assert.ok(records.has(id), `目录缺失 ${id}`)
    }
  }
  assert.equal(records.size, catalog.length)
  assert.equal(catalog.length, summary.eligibleObjects)
})

test('每个名称坐标都有可追溯的 OSM 现役对象或明确的用户补充，经纬顺序有效', async () => {
  const supplements = await json('user-provided-coordinates.json')
  assert.equal(Object.keys(coordinates).length, summary.coordinateNames)
  assert.equal(Object.values(provenance).filter(row => row.source === 'user-provided').length, summary.userProvidedCoordinateNames)
  for (const [name, value] of Object.entries(coordinates)) {
    assert.ok(value[0] >= 70 && value[0] <= 140 && value[1] >= 10 && value[1] <= 56, `经纬顺序或地域错误：${name}`)
    if (provenance[name]?.source === 'user-provided') {
      const entry = supplements[provenance[name].station]
      assert.ok(entry, `未留档的用户补充：${name}`)
      assert.ok([provenance[name].station, ...entry.aliases].includes(name))
      assert.deepEqual(value, entry.coordinates)
      assert.deepEqual(provenance[name].evidence, entry)
      assert.equal(provenance[name].selectedId, undefined, '不伪造现役 OSM 来源')
      continue
    }
    const record = records.get(provenance[name]?.selectedId)
    assert.ok(record, `无源对象：${name}`)
    assert.ok(acceptedRailwayTypes.has(record.type))
    assert.deepEqual(record.types, classifyFacility(record.tags).types)
    assert.equal(record.state, 'present')
    assert.equal(classifyFacility(record.tags).eligible, true)
    assert.deepEqual(value, record.coordinates)
  }
})

test('新桥按用户指定节点定位，云山和西湖东按 suburban 纳入，匹配当前 OSM 核查坐标', async () => {
  const live = await json('identity/supplement-stations.json')
  const expected = { 新桥: 7742242697, 云山: 3677430195, 西湖东: 3693383858 }
  for (const [name, id] of Object.entries(expected)) {
    const sourceId = `node/${id}`
    const verified = live.elements.find(element => element.type === 'node' && element.id === id)
    assert.ok(verified)
    assert.deepEqual(rawById.get(sourceId).tags, verified.tags)
    assert.deepEqual(coordinates[name], [verified.lon, verified.lat])
    assert.equal(provenance[name].selectedId, sourceId)
    assert.equal(records.get(sourceId).type, name === '新桥' ? 'train' : 'suburban')
  }
  assert.equal(provenance['新桥'].reason, 'user-confirmed-osm-identity')
  assert.ok(records.has('node/8341413017'), '异地同名新桥仍应保留源对象')
})

test('用户指定站点消歧，天桥与古城子分别定位，林子头别名可追溯，异地同名节点仍保留', async () => {
  const reviewed = await json('reviewed-name-resolutions.json')
  const expected = {
    常村: 8398804169, 古城子: 8840528310, 天桥: 7527334064,
    遥林: 2156363610, 林子头: 2156363610, 铁厂: 1550539301,
    桥头: 2349438745, 青沟子: 12844704701, 三家子: 9169253672
  }
  for (const [name, id] of Object.entries(expected)) {
    const sourceId = `node/${id}`
    const element = rawById.get(sourceId)
    assert.ok(element)
    assert.deepEqual(coordinates[name], [element.lon, element.lat])
    assert.equal(provenance[name].selectedId, sourceId)
    assert.equal(provenance[name].reason, 'user-confirmed-osm-identity')
    assert.equal(reviewed[name].selectedId, sourceId)
    assert.deepEqual(records.get(sourceId).tags, element.tags, '保留原始 OSM 标签')
  }
  assert.notDeepEqual(coordinates['天桥'], coordinates['古城子'])
  assert.equal(reviewed['天桥'].aliasOf, undefined)
  for (const suffix of ['', '站', '火车站']) {
    assert.deepEqual(coordinates['天桥' + suffix], coordinates['天桥'])
    assert.equal(provenance['天桥' + suffix].selectedId, 'node/7527334064')
  }
  for (const [alias, canonical] of [['林子头', '遥林']]) {
    assert.equal(reviewed[alias].aliasOf, canonical)
    assert.equal(provenance[alias].matchSource, 'user-confirmed-alias')
    for (const suffix of ['', '站', '火车站']) {
      assert.deepEqual(coordinates[alias + suffix], coordinates[canonical])
    }
  }
  for (const id of ['node/10885904305', 'node/10973711950', 'node/7527334064',
    'node/9123967457', 'node/12725718355', 'node/9121997539', 'node/10901470924',
    'node/9169253668', 'node/13437566513']) {
    assert.ok(records.has(id), `异地同名源对象不应被删除：${id}`)
  }
})

test('龙池按指定节点消歧，饮马峡匹配大柴旦东，蒋村保留用户提供的精确坐标及来源', async () => {
  for (const [name, id] of Object.entries({ 龙池: 1681825098, 大柴旦东: 7276945325, 饮马峡: 7276945325 })) {
    const element = rawById.get(`node/${id}`)
    assert.deepEqual(coordinates[name], [element.lon, element.lat])
    assert.equal(provenance[name].selectedId, `node/${id}`)
    assert.deepEqual(records.get(`node/${id}`).tags, element.tags)
  }
  assert.equal(rawById.get('node/7276945325').tags.old_name, '饮马峡')
  for (const suffix of ['', '站', '火车站']) {
    assert.deepEqual(coordinates['饮马峡' + suffix], coordinates['大柴旦东'])
    assert.equal(provenance['饮马峡' + suffix].matchSource, 'user-confirmed-alias')
    assert.deepEqual(coordinates['蒋村' + suffix], [113.027942, 38.532911])
    assert.equal(provenance['蒋村' + suffix].source, 'user-provided')
  }
  const supplement = (await json('user-provided-coordinates.json'))['蒋村']
  assert.equal(supplement.originalCoordinate, '38.532911N/113.027942E')
  assert.equal(classifyFacility(rawById.get(supplement.relatedOsmId).tags).eligible, false)
  assert.equal(records.has(supplement.relatedOsmId), false, '不将矛盾生命周期节点改为现役')
})

test('同名地铁、跨国同名站和已知严重偏移得到修正', () => {
  assert.ok(coordinates['新和'][0] < 90 && coordinates['新和'][1] > 40)
  assert.ok(coordinates['世博园'][0] > 120 && coordinates['世博园'][1] > 40)
  assert.ok(coordinates['王家湾'][0] < 106 && coordinates['王家湾'][1] > 34)
  assert.ok(coordinates['红星'][1] > 47)
  assert.ok(coordinates['万荣'][1] < 22 && coordinates['万荣'][0] < 105)
  assert.deepEqual(coordinates['香港西九龙'], [114.1649267, 22.3036814])
  assert.deepEqual(coordinates['万象'], [102.6907418, 18.0470506])
  assert.deepEqual(coordinates['磨丁'], [101.6712789, 21.1551437])
  assert.deepEqual(coordinates['郏县'], [113.2644081, 33.9467065])
  assert.deepEqual(coordinates['禹州'], [113.5646653, 34.1255719])
  assert.equal(coordinates['建设'], undefined)
})

test('旧站只供历史使用，坐标来自已核实的原始设施且没有估算补齐', async () => {
  const historicalSources = await json('historical-provenance.json')
  const baseline = JSON.parse(gunzipSync(await readFile(new URL('previous-coordinates.json.gz', auditRoot))))
  assert.ok(historicalStationCoordinates['皇姑屯'])
  assert.equal(coordinates['皇姑屯'], undefined)
  for (const [name, value] of Object.entries(historicalStationCoordinates)) {
    assert.ok(Object.hasOwn(baseline, name), `不是原有旧站：${name}`)
    const source = historicalSources[name]
    const element = rawById.get(source.selectedId)
    assert.ok(element, `旧站无原始源对象：${name}`)
    assert.ok(classifyFacility(element.tags).types.some(type => acceptedRailwayTypes.has(type)))
    assert.ok(['present', 'disused', 'abandoned', 'razed', 'preserved'].includes(source.state))
    assert.deepEqual(value, featureCoordinates(element).map(number => Math.round(number * 1e7) / 1e7))
    assert.ok(source.baselineDistanceKm <= 3)
  }
})

test('原有 6939 条坐标逐项核查且没有遗漏，未解决问题明确留档', async () => {
  const audit = await json('previous-coordinate-audit.json')
  const baseline = JSON.parse(gunzipSync(await readFile(new URL('previous-coordinates.json.gz', auditRoot))))
  assert.equal(audit.length, Object.keys(baseline).length)
  assert.equal(new Set(audit.map(row => row.name)).size, audit.length)
  assert.equal(Object.values(summary.previousStatusCounts).reduce((sum, count) => sum + count, 0), audit.length)
  const missing = await json('unresolved-official-stations.json')
  assert.equal(missing.length, summary.unresolvedOfficial)
  for (const row of missing) assert.equal(coordinates[row.name], undefined)
})
