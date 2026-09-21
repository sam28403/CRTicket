import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import stationData from '@/station_name.js'
import { disableAirSeats } from '@/utils/ticketShared.js'

export const stations = stationData
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

function normalizeStationName(name, shouldNormalize = false) {
  if (!name) return ''
  if (!shouldNormalize) return name
  return name.endsWith('站') ? name.slice(0, -1) : name
}

export function queryStationSearch(queryString, cb) {
  const keyword = queryString?.toLowerCase?.() || ''
  const results = queryString
    ? stations.filter((station) =>
        station.name.includes(queryString) ||
        station.abbr.toLowerCase().includes(keyword) ||
        station.en.toLowerCase().includes(keyword)
      )
    : []

  cb(
    results.map((station) => ({
      value: station.name,
      label: `${station.name} (${station.city})`
    }))
  )
}

export function handleStationSelect(ticket, field, item) {
  const value = item.value
  ticket[field] = value

  if (field === 'from' && value === ticket.to) {
    ElMessage.warning('起点和终点不能相同，请重新选择')
    ticket.from = value
    ticket.to = ''
    return
  }

  if (field === 'to' && value === ticket.from) {
    ElMessage.warning('起点和终点不能相同，请重新选择')
    ticket.to = value
    ticket.from = ''
    return
  }

  ticket[field] = value
}

export function formatStationName(name, shouldNormalize = false) {
  const cleanName = normalizeStationName(name, shouldNormalize)
  if (!cleanName) return ''
  if (cleanName.length === 1) return `　${cleanName}　`
  if (cleanName.length === 2) return `${cleanName[0]}　${cleanName[1]}`
  return cleanName
}

export function getStationEnglish(name, shouldNormalize = false) {
  const cleanName = normalizeStationName(name, shouldNormalize)
  if (!cleanName) return ''
  if (cleanName === '香港西九龙') return 'HKWestKowloon'

  const station = stations.find((item) => item.name === cleanName)
  if (!station) return ''
  return station.en.charAt(0).toUpperCase() + station.en.slice(1)
}

export function useSeatType(ticket) {
  const value3 = ref(false)
  const credit = ref(false)

  const airSwitchDisabled = computed(() => disableAirSeats.includes(ticket.seatType))

  const finalSeatType = computed(() => {
    if (!ticket.seatType) return ''
    if (value3.value && !airSwitchDisabled.value) {
      return `新空调${ticket.seatType}`
    }
    return ticket.seatType
  })

  const specialTicketType = computed(() => (credit.value ? '◯' : ''))
  const useCreditLabel = computed(() => (credit.value ? '赠' : ''))

  watch(
    () => ticket.seatType,
    () => {
      if (airSwitchDisabled.value) {
        value3.value = false
      }
    }
  )

  return {
    value3,
    credit,
    airSwitchDisabled,
    finalSeatType,
    specialTicketType,
    useCreditLabel,
  }
}
