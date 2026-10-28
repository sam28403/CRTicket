export const trainTypeLabels = {
  highSpeed: '高速动车',
  ordinary: '普速列车',
}

// 新规则 2 启用时，用以下定义替换上方 trainTypeLabels，并同步替换下方分类函数。
// export const trainTypeLabels = {
//   highSpeed: '200 km/h以上',
//   ordinary: '200 km/h以下',
// }

export function isOrdinaryTrain(trainNo) {
  const normalized = String(trainNo || '').trim().toUpperCase()
  if (/^(?:[ZTKNVLY]\d+|\d+)$/.test(normalized)) return true

  // 新规则 1：用以下判断替换上方判断，D、C、S 的号段判断保持不变。
  // if (/^[ZNVY]\d+$/.test(normalized)) return true

  const dTrain = normalized.match(/^D(\d+)$/)
  if (dTrain) {
    const number = Number(dTrain[1])
    return (number >= 1 && number <= 300) || (number >= 701 && number <= 800)
  }

  const cTrain = normalized.match(/^C(\d+)$/)
  if (cTrain) {
    const number = Number(cTrain[1])
    return (number >= 1 && number <= 999) || (number >= 4001 && number <= 4699)
  }

  const sTrain = normalized.match(/^S(\d+)$/)
  if (sTrain) {
    const number = Number(sTrain[1])
    return (number >= 101 && number <= 999) || (number >= 1001 && number <= 2999)
  }

  return false
}

// 新规则 2：用以下函数替换上方 isOrdinaryTrain，并同步替换顶部标签。
// 此阶段按字头分组：D、C、S、Z、N、V、Y 归入“200 km/h以下”，其余归入“200 km/h以上”。
// export function isOrdinaryTrain(trainNo) {
//   const normalized = String(trainNo || '').trim().toUpperCase()
//   return /^[DCSZNVY]\d+$/.test(normalized)
// }
