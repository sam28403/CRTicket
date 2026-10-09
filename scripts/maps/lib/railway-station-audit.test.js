import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyFacility, featureCoordinates, stationAliases, clusterCandidates } from './railway-station-audit.js'

test('按照 ORM 类型规则纳入默认 train、多交通模式车站，排除明确地铁类型', () => {
  assert.equal(classifyFacility({ railway: 'station' }).eligible, true)
  assert.equal(classifyFacility({ railway: 'halt', train: 'yes', subway: 'yes' }).eligible, true)
  assert.equal(classifyFacility({ railway: 'station', station: 'train;subway' }).eligible, true)
  assert.equal(classifyFacility({ railway: 'station', station: 'subway', train: 'yes' }).eligible, false)
  assert.equal(classifyFacility({ railway: 'station', subway: 'yes' }).eligible, false)
  assert.equal(classifyFacility({ railway: 'tram_stop' }).eligible, false)
})

test('拟建、在建、废弃设施与生命周期冲突均不冒充 present', () => {
  for (const state of ['construction', 'proposed', 'disused', 'abandoned', 'razed', 'preserved']) {
    assert.equal(classifyFacility({ [`${state}:railway`]: 'station', train: 'yes' }).eligible, false)
  }
  const conflict = classifyFacility({ railway: 'station', 'disused:railway': 'station', train: 'yes' })
  assert.equal(conflict.eligible, false)
  assert.deepEqual(conflict.states, ['present', 'disused'])
  assert.equal(classifyFacility({ railway: 'stop_position', train: 'yes' }).eligible, false)
})

test('纳入 suburban 及混合类型，仍排除非 present 的市郊铁路站', () => {
  assert.equal(classifyFacility({ railway: 'station', station: 'suburban', train: 'yes' }).eligible, true)
  assert.equal(classifyFacility({ railway: 'station', station: 'suburban' }).eligible, true)
  assert.equal(classifyFacility({ railway: 'halt', station: 'subway; suburban' }).eligible, true)
  assert.equal(classifyFacility({ railway: 'station', station: 'train;suburban' }).eligible, true)
  assert.equal(classifyFacility({ 'disused:railway': 'station', station: 'suburban' }).eligible, false)
  assert.equal(classifyFacility({ railway: 'station', station: 'suburban', 'construction:railway': 'station' }).eligible, false)
})

test('站场编号不能被误拆成站名，多语言名称、简繁转换和后缀正常匹配', () => {
  const yard = stationAliases({ name: '北京西II场' }).map(alias => alias.name)
  assert.ok(yard.includes('北京西II场'))
  assert.ok(!yard.includes('北京西'))
  const lao = stationAliases({ name: 'ວຽງຈັນ 万象', 'name:zh': '万象' }).map(alias => alias.name)
  assert.ok(lao.includes('万象'))
  const hk = stationAliases({ name: '紅磡 Hung Hom' }, { '紅磡 Hung Hom': '红磡 Hung Hom' }).map(alias => alias.name)
  assert.ok(hk.includes('红磡'))
  assert.ok(stationAliases({ name: '上海虹桥火车站' }).some(alias => alias.name === '上海虹桥'))
  assert.ok(!stationAliases({ old_name: '旧车站', name: '新车站' }).some(alias => alias.name === '旧车站'))
})

test('直接保留 OSM 节点经纬顺序，面和线的中心使用完整几何', () => {
  assert.deepEqual(featureCoordinates({ type: 'node', lon: 114.1649267, lat: 22.3036814 }), [114.1649267, 22.3036814])
  const square = [{ lon: 114, lat: 22 }, { lon: 114.001, lat: 22 }, { lon: 114.001, lat: 22.001 }, { lon: 114, lat: 22.001 }, { lon: 114, lat: 22 }]
  const center = featureCoordinates({ type: 'way', geometry: square })
  assert.ok(Math.abs(center[0] - 114.0005) < 1e-7)
  assert.ok(center[1] > 22 && center[1] < 22.001)
  const line = featureCoordinates({ type: 'way', geometry: [{ lon: 114, lat: 22 }, { lon: 114.002, lat: 22 }] })
  assert.ok(Math.abs(line[0] - 114.001) < 1e-7)
  assert.ok(Math.abs(line[1] - 22) < 1e-7)
  const relation = featureCoordinates({ type: 'relation', tags: { type: 'multipolygon' }, members: [
    { type: 'way', role: 'outer', geometry: square.slice(0, 3) },
    { type: 'way', role: 'outer', geometry: square.slice(2) }
  ] })
  assert.ok(Math.abs(relation[0] - center[0]) < 1e-7)
  assert.ok(Math.abs(relation[1] - center[1]) < 1e-7)
  assert.equal(featureCoordinates({ type: 'way', geometry: [null] }), null)
  assert.equal(featureCoordinates({ type: 'relation', tags: { type: 'multipolygon' }, members: [{ type: 'way', role: 'outer' }] }), null)
})

test('同名地点不会经由链式接近被合并为一个车站', () => {
  const candidates = [0, 0.005, 0.01].map(longitude => ({ coordinates: [longitude, 0] }))
  assert.equal(clusterCandidates(candidates).length, 2)
})
