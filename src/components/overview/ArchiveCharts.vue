<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { useTheme } from '@/composables/useTheme.js'
import { parseStations } from '@/utils/stations.js'
import { createCharts as createMap } from './archiveMapChart.js'
import { createCharts as createCalendar } from './archiveCalendarChart.js'
import { createCharts as createRankings } from './archiveRankingCharts.js'

const props = defineProps({
  tickets: { type: Array, required: true },
  map: { type: Boolean, default: false },
})
const { isDark, resolvedTheme } = useTheme()
const mapChartRef = ref(null)
const calendarChartRef = ref(null)
const statisticsChartRef = ref(null)
const cityChartRef = ref(null)
const selectedMonth = ref('2026-11')
const stations = new Map(parseStations().map(station => [station.name, station.city]))
const getCityName = name => stations.get(name) || ''
const chartText = () => getComputedStyle(document.documentElement)
  .getPropertyValue('--el-text-color-primary').trim()
const chartBackground = () => getComputedStyle(document.documentElement)
  .getPropertyValue('--el-bg-color').trim()
const ticketHistory = computed(() => props.tickets.map(ticket => ({
  departureStation: ticket.departure_station,
  arrivalStation: ticket.arrival_station,
})))
const countStations = field => {
  const counts = new Map()
  props.tickets.forEach(ticket => counts.set(ticket[field], (counts.get(ticket[field]) || 0) + 1))
  return [...counts].map(([station, count]) => ({ station, count }))
}
const statisticsData = computed(() => ({
  departures: countStations('departure_station'),
  arrivals: countStations('arrival_station'),
}))
const monthlyData = computed(() => {
  const counts = new Map()
  for (const ticket of props.tickets) {
    const date = ticket.travel_date.replace('年', '-').replace('月', '-').replace('日', '')
    if (date.startsWith(selectedMonth.value)) counts.set(date, (counts.get(date) || 0) + 1)
  }
  return [...counts].map(([travel_date, count]) => ({ travel_date, count }))
})
const context = {
  mapChartRef, calendarChartRef, statisticsChartRef, cityChartRef,
  ticketHistory, monthlyData, selectedMonth, statisticsData,
  isDark, chartText, chartBackground, getCityName,
}
const { renderMapChart } = createMap(context)
const { renderCalendarChart } = createCalendar(context)
const { renderStationChart, renderCityChart } = createRankings(context)
const refs = [mapChartRef, calendarChartRef, statisticsChartRef, cityChartRef]
let observer
let stopped = false
let renderFrame = 0
const render = () => {
  if (stopped) return
  const containers = props.map
    ? [mapChartRef.value]
    : [statisticsChartRef.value, cityChartRef.value, calendarChartRef.value]
  if (containers.some(element => !element?.clientWidth || !element?.clientHeight)) return
  if (props.map) renderMapChart()
  else {
    renderStationChart()
    renderCityChart()
    renderCalendarChart()
  }
}
function scheduleRender() {
  if (stopped || renderFrame) return
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0
    render()
  })
}
onMounted(() => {
  observer = new ResizeObserver(scheduleRender)
  refs.forEach(item => { if (item.value) observer.observe(item.value) })
})
watch([() => props.tickets, resolvedTheme, selectedMonth], async () => {
  await nextTick()
  scheduleRender()
}, { flush: 'post' })
onBeforeUnmount(() => {
  stopped = true
  cancelAnimationFrame(renderFrame)
  observer?.disconnect()
  refs.forEach(item => { if (item.value) echarts.getInstanceByDom(item.value)?.dispose() })
})
</script>

<template>
  <el-card class="statistics-card" shadow="never">
    <template #header><h3>个人运转数据</h3></template>
    <section v-if="map" class="map-section">
      <h4>历史运转轨迹</h4>
      <div ref="mapChartRef" class="map-container" />
    </section>
    <template v-else>
      <div ref="statisticsChartRef" class="chart-container" />
      <div class="chart-grid">
        <div ref="cityChartRef" class="chart-container" />
        <div class="calendar-wrapper">
          <div class="calendar-header">
            <span>月度运转日历</span>
            <el-date-picker
              v-model="selectedMonth"
              type="month"
              format="YYYY-MM"
              value-format="YYYY-MM"
              :clearable="false"
              size="small"
              aria-label="选择月份"
            />
          </div>
          <div ref="calendarChartRef" class="calendar-container" />
        </div>
      </div>
    </template>
  </el-card>
</template>

<style scoped>
h3, h4 { margin: 0; font-size: 16px; }
h4 { margin-bottom: 16px; }
.chart-container { width: 100%; height: 320px; margin-bottom: 16px; }
.chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.calendar-wrapper { border-radius: 12px; padding: 16px; background: var(--el-bg-color); min-width: 0; }
.calendar-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.calendar-header :deep(.el-date-editor) { width: 130px; }
.calendar-header span { font-weight: 500; white-space: nowrap; }
.calendar-container { width: 100%; height: 360px; }
.map-container { width: 100%; height: clamp(340px, 55vw, 500px); border-radius: 12px; }
.statistics-card { min-width: 0; }
@media (max-width: 760px) {
  .chart-grid { grid-template-columns: 1fr; }
  .calendar-wrapper { padding: 0; }
}
@media (max-width: 420px) {
  .statistics-card :deep(.el-card__body) { padding: 12px; }
  .calendar-header { flex-wrap: wrap; }
}
@media (max-width: 600px) {
  .map-container { height: calc(var(--archive-preview-height, 660px) - 126px); min-height: 240px; }
}
</style>
