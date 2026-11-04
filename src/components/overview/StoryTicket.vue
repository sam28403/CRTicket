<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import TicketArtwork from '@/components/TicketArtwork.vue'
import { useTicketQRCode } from '@/composables/useTicketQRCode.js'
import { themeOptions } from '@/utils/ticketShared.js'

const props = defineProps({ ticket: { type: Object, required: true } })
const artwork = computed(() => ({
  ...props.ticket,
  price: props.ticket.price?.replace(' 元', ''),
  theme: themeOptions.find(option => option.label === props.ticket.theme)?.id || 'Blank.jpg',
}))
const qrCodeUrl = useTicketQRCode(() => props.ticket.number)
const frame = ref(null)
const baseWidth = 430
const scale = ref(1)
let observer

onMounted(() => {
  scale.value = frame.value.clientWidth / baseWidth
  observer = new ResizeObserver(([entry]) => {
    scale.value = entry.contentRect.width / baseWidth
  })
  observer.observe(frame.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div
    ref="frame"
    class="artwork-preview"
    aria-label="车票实时预览"
    :style="{ '--base-width': baseWidth + 'px', '--ticket-scale': scale }"
  >
    <TicketArtwork
      :ticket="artwork"
      :final-seat-type="artwork.seatType"
      :qr-code-url="qrCodeUrl"
    />
  </div>
</template>

<style scoped>
.artwork-preview {
  position: relative;
  justify-self: center;
  width: min(100%, var(--base-width));
  aspect-ratio: 86 / 54;
}
.artwork-preview :deep(.ticket-container) {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--base-width);
  transform: scale(var(--ticket-scale));
  transform-origin: top left;
}
</style>
