export function clockMinutes(value) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
}
