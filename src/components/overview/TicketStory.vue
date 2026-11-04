<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import StoryFields from './StoryFields.vue'
import StoryTicket from './StoryTicket.vue'
import { demoFields } from './demoFields.js'

const scene = ref(null)
const count = ref(0)
const ticket = computed(() => Object.fromEntries(
  demoFields.slice(0, count.value).map(([key, , value]) => [key, value])
))

let frame = 0
let staticView
function update() {
  frame = 0
  const rect = scene.value.getBoundingClientRect()
  const progress = -rect.top / Math.max(1, rect.height - innerHeight)
  count.value = staticView.matches ? demoFields.length : Math.min(
    demoFields.length, Math.max(0, Math.floor(progress * (demoFields.length + 2)))
  )
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(update)
}
onMounted(() => {
  staticView = matchMedia('(prefers-reduced-motion: reduce), (max-height: 500px)')
  update()
  staticView.addEventListener('change', schedule)
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
})
onUnmounted(() => {
  cancelAnimationFrame(frame)
  staticView.removeEventListener('change', schedule)
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', schedule)
})
</script>

<template>
  <section ref="scene" class="scene" aria-label="车票制作演示">
    <div class="stage">
      <div class="caption">
        <span>车票制作演示</span>
        <h2>从上海虹桥，到日照。</h2>
        <p>向下滚动，看看 G4454 的行程如何填进一张车票。</p>
      </div>
      <div class="workspace">
        <StoryFields :count="count" />
        <StoryTicket :ticket="ticket" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.scene {
  height: 340vh;
  background: var(--el-fill-color-light);
}
.stage {
  box-sizing: border-box;
  position: sticky;
  top: 0;
  min-height: 100svh;
  max-width: 1280px;
  margin: auto;
  padding: clamp(12px, 3vh, 36px) clamp(16px, 4vw, 60px);
  display: grid;
  align-content: center;
}
.caption span {
  color: var(--el-color-primary);
  font-weight: 600;
}
.workspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(18px, 4vw, 56px);
  align-items: center;
}
@media (max-width: 700px) {
  .workspace { grid-template-columns: 1fr; gap: 12px; }
  .workspace :deep(dl) { max-height: 19svh; }
}
@media (prefers-reduced-motion: reduce), (max-height: 500px) {
  .scene { height: auto; }
  .stage { position: static; min-height: auto; }
  .workspace :deep(dl) { max-height: none; }
  .caption p { display: none; }
}
</style>
