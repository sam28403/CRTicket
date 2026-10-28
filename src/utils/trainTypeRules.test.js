import test from 'node:test'
import assert from 'node:assert/strict'
import { isOrdinaryTrain, trainTypeLabels } from './trainTypeRules.js'

test('当前 C 字头普速范围截至 C4699，保留 C1 至 C999', () => {
  for (const train of ['C1', 'C999', 'C4001', 'C4699', ' c4699 ']) {
    assert.equal(isOrdinaryTrain(train), true, train)
  }
  for (const train of ['C0', 'C1000', 'C4000', 'C4700', 'C4999', 'C5000']) {
    assert.equal(isOrdinaryTrain(train), false, train)
  }
})

test('普速类别包含新增 N、V 字头，并保留原有类别及 D、S 号段', () => {
  for (const train of [
    'Z1', 'T1', 'K1', 'L1', 'Y1', '1461',
    'N1', 'N1998', 'V1', 'V6501', 'V7998', ' n1 ', ' v6501 ',
    'D1', 'D300', 'D701', 'D800', 'S101', 'S999', 'S1001', 'S2999',
  ]) {
    assert.equal(isOrdinaryTrain(train), true, train)
  }
  for (const train of [
    'X1', 'G1', 'D0', 'D301', 'D700', 'D801',
    'S100', 'S1000', 'S3000', '', 'C4699A',
  ]) {
    assert.equal(isOrdinaryTrain(train), false, train)
  }
  assert.deepEqual(trainTypeLabels, { highSpeed: '高速动车', ordinary: '普速列车' })
})
