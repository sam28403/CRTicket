<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ArchiveMap from './ArchiveMap.vue'
import ArchiveStatistics from './ArchiveStatistics.vue'
import ArchiveHistory from './ArchiveHistory.vue'
import { archiveTickets } from './archiveTickets.js'

const labels = ['足迹地图', '运转统计', '历史车票']
const components = [ArchiveMap, ArchiveStatistics, ArchiveHistory]
const track = ref(null)
const viewport = ref(null)
const content = ref(null)
const active = ref(0)
const scale = ref(1)
const contentWidth = ref(0)
const contentHeight = ref(0)
const mobile = ref(false)
const pageProgress = ref(0)
const viewportHeight = ref(0)
const offset = computed(() => mobile.value
  ? Math.max(0, contentHeight.value - viewportHeight.value) * pageProgress.value
  : 0)
const frameStyle = computed(() => ({
  width: `${contentWidth.value * scale.value}px`,
  height: `${mobile.value ? viewportHeight.value : contentHeight.value * scale.value}px`,
}))
let observer
let scrollFrame = 0
let disposed = false

function fitPreview() {
  if (!viewport.value || !content.value) return
  mobile.value = window.innerWidth <= 600
  viewportHeight.value = viewport.value.clientHeight
  contentWidth.value = !mobile.value && active.value === 2
    ? Math.max(860, viewport.value.clientWidth)
    : viewport.value.clientWidth
  contentHeight.value = content.value.offsetHeight
  scale.value = mobile.value ? 1 : Math.min(
    1,
    viewport.value.clientWidth / Math.max(contentWidth.value, 1),
    viewport.value.clientHeight / Math.max(contentHeight.value, 1),
  )
}

function updatePage() {
  scrollFrame = 0
  if (!track.value) return
  const bounds = track.value.getBoundingClientRect()
  const distance = Math.max(1, bounds.height - window.innerHeight)
  const progress = Math.max(0, Math.min(1, -bounds.top / distance))
  active.value = Math.min(2, Math.floor(progress * 3))
  pageProgress.value = Math.min(1, progress * 3 - active.value)
}

function handleScroll() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updatePage)
}

async function observePreview() {
  await nextTick()
  if (disposed) return
  observer?.disconnect()
  if (content.value) observer?.observe(content.value)
  if (viewport.value) observer?.observe(viewport.value)
  fitPreview()
}

onMounted(() => {
  observer = new ResizeObserver(fitPreview)
  observePreview()
  updatePage()
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleScroll, { passive: true })
})
watch(content, observePreview)
onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  cancelAnimationFrame(scrollFrame)
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleScroll)
})
</script>

<template>
  <div ref="track" class="archive-scroll-track">
    <div class="archive-preview">
      <div class="archive-pages" aria-label="行程档案演示页">
        <span
          v-for="(label, index) in labels"
          :key="label"
          :class="{ active: active === index }"
          :aria-current="active === index ? 'step' : undefined"
        >{{ label }}</span>
      </div>
      <div ref="viewport" class="preview-viewport">
        <div class="preview-frame" :style="frameStyle">
          <Transition name="archive-fade" mode="out-in" @enter="observePreview">
            <div
              :key="active"
              ref="content"
              class="preview-content"
              inert
              :style="{
                width: `${contentWidth}px`,
                transform: `translateY(-${offset}px) scale(${scale})`,
                '--archive-preview-height': `${viewportHeight}px`,
              }"
            >
              <component :is="components[active]" :tickets="archiveTickets" />
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.archive-scroll-track {
  position: relative;
  height: 320svh;
  margin-top: 32px;
  min-width: 0;
}
.archive-preview {
  position: sticky;
  top: 16px;
  box-sizing: border-box;
  height: calc(100svh - 32px);
  padding: clamp(12px, 3vw, 36px);
  display: flex;
  flex-direction: column;
  gap: 18px;
  border-radius: 16px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  text-align: left;
  overflow: hidden;
}
.archive-pages {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.archive-pages span {
  padding: 9px 16px;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  font-size: 14px;
}
.archive-pages span:first-child { border-radius: 5px 0 0 5px; }
.archive-pages span:last-child { border-radius: 0 5px 5px 0; }
.archive-pages span + span { border-left: 0; }
.archive-pages .active {
  color: var(--el-color-white);
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.preview-viewport {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-frame { position: relative; flex-shrink: 0; }
.preview-content {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  pointer-events: none;
}
.archive-fade-enter-active,
.archive-fade-leave-active {
  transition: opacity 220ms ease;
}
.archive-fade-enter-from,
.archive-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .archive-fade-enter-active,
  .archive-fade-leave-active {
    transition: none;
  }
}
@media (max-width: 480px) {
  .archive-preview { padding: 10px; gap: 12px; }
  .archive-pages span { padding: 8px 10px; font-size: 13px; }
}
@media (max-width: 600px) {
  .archive-scroll-track { height: 480svh; }
  .preview-viewport { overflow: hidden; align-items: flex-start; }
}
</style>
