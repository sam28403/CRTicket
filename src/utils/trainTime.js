export function matchesDepartureTime(departure, [startHour, endHour]) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(departure || '')
  // 时刻未公布的车次（如运行图调整）无法判断是否在范围内，保留展示。
  if (!match) return true
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return true
  const minutes = hour * 60 + minute
  return minutes >= startHour * 60 && minutes < endHour * 60
}
