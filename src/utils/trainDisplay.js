// 离线方案后缀只用于查找记录，显示时保留车次前缀和双车次号。
export function displayTrainCode(code) {
  return String(code ?? '').replace(/(\d)[A-Z]+(?=\/|$)/gi, '$1')
}

export function trainInfoForDisplay(result) {
  return {
    ...result,
    train: displayTrainCode(result.train),
    stops: result.stops.map(stop => ({
      ...stop,
      train: displayTrainCode(stop.train),
    })),
  }
}
