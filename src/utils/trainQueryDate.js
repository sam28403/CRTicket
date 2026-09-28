const dayMs = 86400000

export function trainQueryRange(now = Date.now()) {
  const today = new Date(now + 8 * 3600000).toISOString().slice(0, 10)
  const midnight = Date.parse(`${today}T00:00:00Z`)
  return {
    today,
    min: new Date(midnight - 2 * dayMs).toISOString().slice(0, 10),
    max: new Date(midnight + 15 * dayMs).toISOString().slice(0, 10),
  }
}

export function isTrainQueryDateInRange(date, now = Date.now()) {
  const { min, max } = trainQueryRange(now)
  return typeof date === 'string' && date >= min && date <= max
}
