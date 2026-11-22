export function getDepartureMinutes(departure) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(departure || '')
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

export function matchesDepartureTime(departure, [startHour, endHour]) {
  const minutes = getDepartureMinutes(departure)
  // 时刻未公布的车次（如运行图调整）无法判断是否在范围内，保留展示。
  if (minutes === null) return true
  return minutes >= startHour * 60 && minutes < endHour * 60
}
