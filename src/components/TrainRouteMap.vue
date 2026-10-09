<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { useTheme } from '@/composables/useTheme'
import { loadChinaMap } from '@/utils/maps/stationCoordinates.js'
import { createRailwayGeo } from '@/utils/maps/railwayMap.js'
import { buildTrainRouteData, trainRouteViewport } from '@/utils/maps/trainRouteMap.js'

const props = defineProps({
  train: { type: String, default: '' },
  stops: { type: Array, required: true }
})
const { isDark, resolvedTheme } = useTheme()
const mapRef = ref(null)
const loading = ref(false)
const error = ref('')
const routeData = computed(() => buildTrainRouteData(props.stops))
let chart
let observer
let renderId = 0

function centerRoute() {
  if (!chart || chart.isDisposed()) return
  chart.setOption({
    geo: trainRouteViewport(routeData.value.points, chart.getWidth(), chart.getHeight())
  })
}

async function renderMap() {
  const id = ++renderId
  chart?.dispose()
  chart = null
  error.value = ''
  loading.value = false
  const { points, lines } = routeData.value
  if (!mapRef.value || !points.length) return
  loading.value = true
  const loaded = await loadChinaMap(echarts)
  if (id !== renderId || !mapRef.value) return
  loading.value = false
  if (!loaded) {
    error.value = '地图数据加载失败，请重试'
    return
  }

  chart = echarts.init(mapRef.value, isDark.value ? 'dark' : undefined)
  const style = getComputedStyle(document.documentElement)
  chart.setOption({
    backgroundColor: style.getPropertyValue('--app-surface').trim() || '#fff',
    title: {
      text: `${props.train} 途经站点`,
      top: 12,
      left: 'center',
      textStyle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: style.getPropertyValue('--app-text').trim() || '#17324d',
        textBorderColor: '#000',
        textBorderWidth: 3
      }
    },
    tooltip: {
      renderMode: 'richText',
      trigger: 'item',
      formatter: params => {
        if (params.seriesType !== 'effectScatter') return ''
        const stop = params.data
        const arrival = stop.isFirst ? '始发站' : (stop.arrival || '—')
        const day = stop.arrival && stop.arrivalDay > 0 ? `（+${stop.arrivalDay} 天）` : ''
        const departure = stop.isLast ? '终到站' : (stop.departure || '—')
        return `${stop.no}. ${stop.name}\n到达：${arrival}${day}\n出发：${departure}`
      }
    },
    geo: createRailwayGeo(trainRouteViewport(points, chart.getWidth(), chart.getHeight())),
    series: [
      {
        name: '线路',
        type: 'lines',
        coordinateSystem: 'geo',
        zlevel: 2,
        symbol: ['none', 'none'],
        effect: {
          show: true,
          period: 4,
          trailLength: 0.4,
          color: '#ff9800',
          symbol: 'circle',
          symbolSize: 4
        },
        lineStyle: { color: '#ff9800', width: 2, opacity: 0.8, curveness: 0 },
        data: lines
      },
      {
        name: '途经站点',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 3,
        rippleEffect: { brushType: 'stroke', scale: 3 },
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          fontSize: 10,
          color: '#17324d',
          textBorderColor: '#e8f5e9',
          textBorderWidth: 3
        },
        labelLayout: { moveOverlap: 'shiftY' },
        symbolSize: (value, params) => params.data.isFirst || params.data.isLast ? 14 : 10,
        itemStyle: { color: '#e53935' },
        data: points.map((point, index) => ({
          ...point,
          label: { position: index % 2 ? 'left' : 'right' }
        }))
      }
    ]
  })
}

onMounted(() => {
  observer = new ResizeObserver(() => {
    if (!chart || chart.isDisposed()) return
    chart.resize()
    centerRoute()
  })
  observer.observe(mapRef.value)
  renderMap()
})
watch(() => [props.stops, props.train, resolvedTheme.value], renderMap, { flush: 'post' })
onBeforeUnmount(() => {
  renderId++
  observer?.disconnect()
  chart?.dispose()
})
</script>

<template>
  <el-card shadow="never" class="train-route-map">
    <template #header>
      <div class="map-heading">
        <strong>车次线路图</strong>
        <el-button size="small" :disabled="loading || !!error || !routeData.points.length" @click="centerRoute">
          线路居中
        </el-button>
      </div>
    </template>
    <el-alert
      v-if="routeData.missingStations.length"
      :title="`暂无坐标：${routeData.missingStations.join('、')}。相关区间暂不连线。`"
      type="info"
      show-icon
      :closable="false"
      class="map-message"
    />
    <div class="map-frame" v-loading="loading" element-loading-text="正在加载线路地图…">
      <div ref="mapRef" class="map-canvas" role="img" :aria-label="`${train} 途经站点线路地图`"></div>
      <div v-if="error || !routeData.points.length" class="map-placeholder">
        <el-empty :description="error || '暂无可定位的站点'">
          <el-button v-if="error" @click="renderMap">重新加载</el-button>
        </el-empty>
      </div>
    </div>
    <p class="map-caption">按站序连线，仅表示站点顺序；可拖动、缩放地图，悬停站点查看到发时间。</p>
  </el-card>
</template>

<style scoped>
.train-route-map { margin-top: 20px; }
.map-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.map-message { margin-bottom: 16px; }
.map-frame { position: relative; }
.map-canvas { width: 100%; height: 500px; }
.map-placeholder { position: absolute; inset: 0; display: grid; place-items: center; }
.map-caption { margin: 12px 0 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }
@media (max-width: 600px) {
  .map-canvas { height: 380px; }
  .train-route-map :deep(.el-card__body) { padding: 12px; }
}
</style>
