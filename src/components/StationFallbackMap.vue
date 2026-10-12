<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { circleMarker, map as createMap, tileLayer } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { stationFallbackTiles, stationMapLocation } from '@/utils/maps/stationLocationMap.js'
import { watchTileLayer } from '@/utils/maps/tileLayerHealth.js'

const props = defineProps({ station: { type: String, required: true } })
const container = ref(null)
let map
let observer
let disposeHealth
let message

onMounted(() => {
  const location = stationMapLocation(props.station)
  if (!location) return
  map = createMap(container.value, { zoomAnimation: false }).setView(location, 16)
  map.attributionControl.setPrefix(false)
  circleMarker(location, {
    radius: 9,
    color: '#fff',
    weight: 3,
    fillColor: '#e53935',
    fillOpacity: 1,
    interactive: false,
  }).addTo(map)

  const source = stationFallbackTiles(import.meta.env.VITE_OSM_MIRROR_TILE_URL?.trim())
  const layer = tileLayer(source.url, source.options)
  disposeHealth = watchTileLayer(layer, () => {
    message = ElMessage.error('检查网络连接')
  })
  layer.addTo(map)
  observer = new ResizeObserver(() => map.invalidateSize({ animate: false }))
  observer.observe(container.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  disposeHealth?.()
  map?.remove()
  message?.close()
})
</script>

<template>
  <div ref="container" class="fallback-map" />
</template>

<style scoped>
.fallback-map {
  width: 100%;
  height: 100%;
}
</style>
