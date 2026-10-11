// 12306 会用站名中的空白区分环线重复停靠；匹配数据时忽略空白，显示和站序保持原样。
export function normalizeStationName(name) {
  return String(name || '').replace(/\s+/g, '')
}

// 推荐列表不作为查询白名单，前后端只校验输入格式与长度。
export function stationQueryName(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return ''
  const name = normalizeStationName(value)
  return name.length <= 30 ? name : ''
}
