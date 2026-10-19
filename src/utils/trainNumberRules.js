const currentRule = /^(\d{4}|5\d{4}|[GCDZTKLYS]\d{1,4})$/i

// 以下号段和辅助函数暂不启用。
// 启用新规则时，先取消此块注释，再在 isValidTrainNumber 中只保留对应的 return。
/*
const rule1Ranges = {
  N: [[1, 1998]],
  V: [[1, 5998], [6001, 6998], [7001, 7998]],
}

const rule2Ranges = {
  ...rule1Ranges,
  X: [[1, 9998]],
}

const rule3Ranges = {
  X: [[1, 9998]],
  G: [[1, 9998]],
  T: [[1, 9998]],
  K: [[1, 9998]],
  D: [[1, 9998]],
  C: [[1, 2998]],
  S: [[1, 2998]],
  Z: [[1, 1998]],
  N: [[1, 1998]],
  V: [[1, 5998], [6001, 6998], [7001, 7998]],
  Y: [[1, 998], [1001, 9998]],
}

function matchesTrainRanges(value, ranges) {
  const match = /^([A-Z])([1-9]\d{0,3})$/i.exec(value)
  if (!match) return false
  const allowed = ranges[match[1].toUpperCase()]
  const number = Number(match[2])
  return Boolean(allowed?.some(([min, max]) => number >= min && number <= max))
}
*/

export function isValidTrainNumber(value) {
  if (typeof value !== 'string') return false

  // 当前规则：保持生效。
  return currentRule.test(value)

  // 新规则 1：保留当前规则，新增指定 N、V 号段。
  // return currentRule.test(value) || matchesTrainRanges(value, rule1Ranges)

  // 新规则 2：保留当前规则，新增指定 N、V、X 号段。
  // return currentRule.test(value) || matchesTrainRanges(value, rule2Ranges)

  // 新规则 3：废除当前规则，仅允许 rule3Ranges 中的号段。
  // return matchesTrainRanges(value, rule3Ranges)
}
