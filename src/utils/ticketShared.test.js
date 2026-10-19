import test from 'node:test'
import assert from 'node:assert/strict'
import { getTrainNumberError, ticketRules } from './ticketShared.js'

test('车次规则接受四位数字、5开头的五位数字及指定字头的1至4位数字', () => {
  for (const value of ['0000', '1461', '50000', '59999']) {
    assert.equal(getTrainNumberError(value), '', value)
  }
  for (const prefix of 'GCDZTKLYSgcdztklys') {
    for (const number of ['1', '12', '123', '1234']) {
      assert.equal(getTrainNumberError(`${prefix}${number}`), '')
    }
  }
})

test('车次规则拒绝空值、超出长度、其他字头、空白、双车次和方案后缀', () => {
  assert.equal(getTrainNumberError(''), '请输入车次')
  for (const value of [
    '1', '123', '12345', '60000', '500000', 'G', 'G12345',
    'N1', 'V1', 'X1', 'A1', ' G1', 'G1 ', 'G1\n', 'G1/G2', 'G1B', 1461,
  ]) {
    assert.equal(getTrainNumberError(value), '请输入正确的车次', String(value))
  }
})

test('表单校验和操作入口使用相同的车次错误提示', () => {
  for (const value of ['', 'X1', 'G12345', 'G1', 'g1', '50001']) {
    ticketRules.trainNo[0].validator({}, value, (error) => {
      assert.equal(error?.message || '', getTrainNumberError(value))
    })
  }
})
