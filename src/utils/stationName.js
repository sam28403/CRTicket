// 12306 会用站名中的空白区分环线重复停靠；匹配数据时忽略空白，显示和站序保持原样。
export function normalizeStationName(name) {
  return String(name || '').replace(/\s+/g, '')
}
