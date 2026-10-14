<script setup>
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from 'vue'
import * as echarts from 'echarts'
import { useTheme } from '@/composables/useTheme'
import { loadChinaMap } from '@/utils/maps/stationCoordinates.js'
import { createRailwayGeo } from '@/utils/maps/railwayMap.js'
import { buildTrainRouteData, trainRouteViewport } from '@/utils/maps/trainRouteMap.js'
import {Warning} from "@element-plus/icons-vue";

const props = defineProps({
  train: { type: String, default: '' },
  stops: { type: Array, required: true }
})
const { isDark, resolvedTheme } = useTheme()
const mapRef = ref(null)
const loading = ref(false)
const error = ref('')
const routeData = computed(() => buildTrainRouteData(props.stops))
const report = () => {
  window.open('https://github.com/sam28403/CRTicket/issues', '_blank')
}
let chart
let observer
let renderId = 0
let active = true

function hasMapSize() {
  return active && mapRef.value?.clientWidth > 0 && mapRef.value?.clientHeight > 0
}

function resizeMap() {
  // KeepAlive 隐藏页面时容器尺寸为 0，不能让动画画布缩放到这个尺寸。
  if (!hasMapSize()) return
  if (!chart || chart.isDisposed()) {
    if (!loading.value && !error.value) renderMap()
    return
  }
  chart.resize()
  centerRoute()
}

function deactivateMap() {
  active = false
  renderId++
  loading.value = false
  observer?.disconnect()
  chart?.dispose()
  chart = null
}

function centerRoute() {
  if (!chart || chart.isDisposed()) return
  chart.setOption({
    geo: trainRouteViewport(routeData.value.points, chart.getWidth(), chart.getHeight())
  })
}

async function renderMap() {
  if (!hasMapSize()) return
  const id = ++renderId
  chart?.dispose()
  chart = null
  error.value = ''
  loading.value = false
  const { points, lines } = routeData.value
  if (!mapRef.value || !points.length) return
  loading.value = true
  const loaded = await loadChinaMap(echarts)
  if (id !== renderId) return
  loading.value = false
  if (!hasMapSize()) return
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
        textBorderColor: isDark.value ? '#000' : '#fff',
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
  observer = new ResizeObserver(resizeMap)
  observer.observe(mapRef.value)
  renderMap()
})
onActivated(() => {
  active = true
  observer?.observe(mapRef.value)
  if (!chart && !loading.value) renderMap()
  else resizeMap()
})
onDeactivated(deactivateMap)
watch(() => [props.stops, props.train, resolvedTheme.value], renderMap, { flush: 'post' })
onBeforeUnmount(deactivateMap)
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
    <p class="map-caption">连线表示站序，不代表实际铁路走向。</p>

    <el-tooltip
        effect="dark"
        content="提交时请注明车次和站点。"
        placement="bottom"
        :popper-options="{
          modifiers: [
            { name: 'flip', enabled: false }
          ]
        }"
    >
      <el-button type="danger" @click="report()" style="margin-top: 8px">
        <el-icon>
          <Warning />
        </el-icon>
        <span>报告错误</span>
      </el-button>
    </el-tooltip>
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
