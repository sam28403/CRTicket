import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateFareByGrade,
  calculateOrdinaryFare,
  getFareDistance,
  getPriceTrainGrade,
} from './ordinaryFare.js'

test('票价等级识别覆盖指定新号段及边界', () => {
  for (const train of [
    'Z1', 'Z1998', 'N1', 'N1998', 'Y1', 'Y998', 'Y1001', 'Y9998',
    'V1', 'V5998', ' v5998 ',
  ]) {
    assert.equal(getPriceTrainGrade(train), '快速', train)
  }
  for (const train of ['V6001', 'V6998']) {
    assert.equal(getPriceTrainGrade(train), '普快', train)
  }
  for (const train of ['V7001', 'V7998']) {
    assert.equal(getPriceTrainGrade(train), '普客', train)
  }
  for (const train of [
    'V5999', 'V6000', 'V6999', 'V7000', 'V7999', 'V8000',
    'V0', 'Z0', 'Z01', 'G1', 'D1', 'C1', '', '123', 'Z1/2',
    'Z1999', 'Z9998', 'N0', 'N1999', 'N9998',
    'Y0', 'Y999', 'Y1000', 'Y9999', 'Y10000',
    'K1', 'T1', 'L1', '1461', '6001', '8998',
  ]) {
    assert.equal(getPriceTrainGrade(train), null, train)
    assert.throws(() => calculateOrdinaryFare({ train, air: 'new', distance: 100 }), train)
  }
})

test('运价里程按区段中点处理，跨区段时切换步长', () => {
  for (const [km, expected] of [
    [20, 20], [200, 195], [201, 210], [400, 390], [401, 415],
    [700, 685], [701, 720], [1100, 1080], [1101, 1125],
    [1601, 1630], [2201, 2235], [2901, 2940],
    [3701, 3745], [4601, 4650], [10000, 9950],
  ]) {
    assert.equal(getFareDistance(km), expected, String(km))
  }
  assert.equal(getFareDistance(1), getFareDistance(20))
  assert.equal(getFareDistance(1, 100), getFareDistance(100, 100))
  assert.equal(getFareDistance(1, 400), getFareDistance(400, 400))
  assert.equal(getFareDistance(36, 100), 100)
  assert.equal(getFareDistance(108, 400), 400)
})

test('1000 公里各席别与公开新空调分项表及附加费用一致', () => {
  const result = calculateOrdinaryFare({ train: ' z1 ', air: 'new', distance: 1000 })
  assert.equal(result.train, 'Z1')
  assert.equal(result.grade, '快速')
  assert.deepEqual(result.fares, [
    { seat: '硬座', price: 128.5 },
    { seat: '软座', price: 204.5 },
    { seat: '硬卧下铺', price: 237.5 },
    { seat: '硬卧中铺', price: 230.5 },
    { seat: '硬卧上铺', price: 222.5 },
    { seat: '软卧下铺', price: 363.5 },
    { seat: '软卧上铺', price: 348.5 },
  ])
})

test('等级、空调和起码里程分别生效', () => {
  const fare = (train, air, distance) => calculateOrdinaryFare({ train, air, distance }).fares
  assert.equal(fare('V7001', 'none', 100)[0].price, 6.5)
  assert.equal(fare('V6001', 'none', 100)[0].price, 7.5)
  assert.equal(fare('Z1', 'none', 100)[0].price, 8.5)
  assert.equal(fare('Z1', 'ordinary', 100)[0].price, 9.5)
  assert.deepEqual(fare('Z1', 'new', 1), fare('Z1', 'new', 20))
  for (const air of ['none', 'ordinary', 'new']) {
    for (const km of [1, 20, 100, 400, 1500, 2501, 10000]) {
      const rows = fare('Z1', air, km)
      assert.ok(rows.every(row => Number.isFinite(row.price) && row.price > 0))
      assert.ok(rows[2].price >= rows[3].price && rows[3].price >= rows[4].price)
      assert.ok(rows[5].price >= rows[6].price)
    }
  }
})

test('用户提供的五组路路通快速新空调硬座价格回归', () => {
  const samples = [
    ['宁波至绍兴', 108, 16.5],
    ['上海松江至杭州南', 162, 24.5],
    ['上海松江至杭州', 147, 23.5],
    ['绍兴至杭州南', 36, 9],
    ['绍兴至杭州', 63, 12.5],
  ]
  for (const [route, distance, expected] of samples) {
    const result = calculateOrdinaryFare({ train: 'N255', air: 'new', distance })
    assert.equal(result.fares[0].price, expected, route)
  }
})

test('长途软卧及非空调七种席别按独立分项表校验', () => {
  const newAir = calculateOrdinaryFare({ train: 'Z88', air: 'new', distance: 1208 })
  assert.equal(newAir.fares[5].price, 427.5)
  const none = calculateOrdinaryFare({ train: 'Z1', air: 'none', distance: 1000 })
  // 客票 52/103，加快 20，卧铺 66/61/56/99/89，保险扣减 1.5。
  assert.deepEqual(none.fares.map(fare => fare.price), [72.5, 122.5, 148.5, 143.5, 138.5, 231.5, 221.5])
})

test('候车空调费只对超过 200 公里的硬席生效', () => {
  const at200 = calculateOrdinaryFare({ train: 'Z1', air: 'none', distance: 200 })
  const over200 = calculateOrdinaryFare({ train: 'Z1', air: 'none', distance: 201 })
  assert.equal(at200.fares[0].price, 16.5)
  assert.equal(over200.fares[0].price, 18.5)
  assert.equal(over200.fares[1].price, 29.5)
})

test('不支持的车次、空调类型和无效里程不产生价格', () => {
  for (const distance of [0, -1, 1.2, 10001, NaN, Infinity, '100']) {
    assert.throws(() => calculateOrdinaryFare({ train: 'Z1', air: 'new', distance }))
  }
  assert.throws(() => calculateOrdinaryFare({ train: 'G1', air: 'new', distance: 100 }))
  assert.throws(() => calculateOrdinaryFare({ train: 'Z1', air: 'other', distance: 100 }))
})

test('按等级查询覆盖九种组合，列表与车次计算共用票价', () => {
  const grades = [
    ['普客', 'V7001', [6.5, 8.5, 12.5]],
    ['普快', 'V6001', [7.5, 9.5, 14.5]],
    ['快速', 'N255', [8.5, 10.5, 16.5]],
  ]
  for (const [grade, train, expected] of grades) {
    for (const [index, air] of ['none', 'ordinary', 'new'].entries()) {
      assert.equal(calculateFareByGrade({ grade, air, distance: 108 }).fares[0].price, expected[index])
      for (const distance of [1, 36, 147, 162, 200, 201, 400, 1000, 2501, 4999, 5000]) {
        const list = calculateFareByGrade({ grade, air, distance })
        const calculator = calculateOrdinaryFare({ train, air, distance })
        assert.deepEqual(list.fares, calculator.fares)
        assert.ok(list.fares.every(fare => Number.isFinite(fare.price)))
      }
    }
  }
  assert.throws(() => calculateFareByGrade({ grade: '其他', air: 'new', distance: 1 }))
})
