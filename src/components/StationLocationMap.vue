<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { stationMapEmbedUrl } from '@/utils/maps/stationLocationMap.js'
import { canConnectTransport } from '@/utils/maps/transportConnection.js'

const StationFallbackMap = defineAsyncComponent(() => import('@/components/StationFallbackMap.vue'))

const props = defineProps({
  station: { type: String, required: true },
})
const mapUrl = computed(() => stationMapEmbedUrl(props.station))
const source = ref('checking')
const controller = new AbortController()
let frameTimer
let networkMessage

onMounted(async () => {
  if (!mapUrl.value) {
    networkMessage = ElMessage.error('未找到该车站的位置')
    return
  }
  const connected = await canConnectTransport(mapUrl.value, { signal: controller.signal })
  if (controller.signal.aborted) return
  if (connected) {
    source.value = 'transport'
    frameTimer = setTimeout(useFallback, 10000)
  } else {
    useFallback()
  }
})

onBeforeUnmount(() => {
  controller.abort()
  clearTimeout(frameTimer)
  networkMessage?.close()
})

function useFallback() {
  clearTimeout(frameTimer)
  if (!controller.signal.aborted) source.value = 'fallback'
}

async function checkLoadedFrame() {
  clearTimeout(frameTimer)
  const connected = await canConnectTransport(mapUrl.value, { signal: controller.signal })
  if (!connected) useFallback()
}
</script>

<template>
  <div
    class="station-location-map"
    role="region"
    :aria-label="`${station}在OpenStreetMap上的位置`"
  >
    <iframe
      v-if="source === 'transport'"
      :src="mapUrl"
      :title="`${station}交通地图`"
      @load="checkLoadedFrame"
      @error="useFallback"
    />
    <StationFallbackMap
      v-else-if="source === 'fallback'"
      :station="station"
    />
  </div>
</template>

<style scoped>
.station-location-map {
  width: 100%;
  height: clamp(380px, 65vh, 640px);
  isolation: isolate;
  border-radius: 4px;
  overflow: hidden;
  background: var(--el-fill-color-light);
}

.station-location-map iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

@media (max-width: 600px) {
  .station-location-map {
    height: 60vh;
    min-height: 360px;
  }
}
</style>
