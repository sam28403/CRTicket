import stationData from '../station_name.js'

export function parseStations() {
  return stationData
    .split('@')
    .filter(Boolean)
    .map((item) => {
      const arr = item.split('|')
      return {
        code: arr[0],
        name: arr[1],
        telecode: arr[2],
        en: arr[3],
        abbr: arr[4],
        city: arr[7],
      }
    })
}
