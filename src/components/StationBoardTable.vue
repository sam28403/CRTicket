<script setup>
import { computed, h, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { RouterLink } from 'vue-router'
import StationLink from '@/components/StationLink.vue'
import StationBoardMobileRow from '@/components/StationBoardMobileRow.vue'
import { stationBoardColumns } from '@/utils/stationBoard.js'
import { currentTrainHighlights } from '@/utils/stationBoardTime.js'
import { stationTrainLocation } from '@/utils/stationNavigation.js'
import { displayTrainCode } from '@/utils/trainDisplay.js'

const props = defineProps({
  rows: { type: Array, required: true },
  tab: { type: String, required: true },
  currentSeconds: { type: Number, required: true },
  follow: { type: Boolean, default: true },
  source: { type: String, required: true },
  date: { type: String, required: true },
})
const emit = defineEmits(['browse'])
const container = ref(null)
const table = ref(null)
let locateFrame
let locateId = 0
const { width, height } = useElementSize(container)
const highlights = computed(() => currentTrainHighlights(props.rows, props.currentSeconds))
const currentIndex = computed(() => {
  const indexes = highlights.value.highlighted
  return indexes.size ? Math.min(...indexes) : highlights.value.nextIndex
})
const compactTable = computed(() => width.value < 600)
const specs = computed(() => stationBoardColumns(props.rows, props.tab))
const mobileFields = computed(() => specs.value.filter(column => column.key !== 'train'))
const estimatedMobileHeight = computed(() => 56 + Math.ceil(mobileFields.value.length / 2) * 47)
const columns = computed(() => {
  if (compactTable.value) {
    return [{ key: 'board', dataKey: 'train', title: '车次信息', width: Math.max(1, width.value - 16) }]
  }
  const totalWidth = specs.value.reduce((total, column) => total + column.width, 0)
  const extra = Math.max(0, width.value - 16 - totalWidth) / specs.value.length
  return specs.value.map(column => ({
    ...column,
    width: column.width + extra,
    align: 'center',
    cellRenderer: ({ cellData, rowData }) => {
      if (column.key === 'train') {
        return h(RouterLink, {
          class: 'board-cell board-link',
          to: stationTrainLocation(rowData, props.source, props.date),
          title: `查看 ${displayTrainCode(cellData)} 时刻表`,
        }, () => displayTrainCode(cellData))
      }
      if (column.key === 'from' || column.key === 'to') {
        return h(StationLink, { class: 'board-cell', name: cellData })
      }
      return h('span', {
        class: 'board-cell',
        title: String(cellData || '—'),
      }, cellData || '—')
    },
  }))
})

async function locateCurrent() {
  const id = ++locateId
  cancelAnimationFrame(locateFrame)
  await nextTick()
  if (id !== locateId || !table.value) return
  // 桌面保留两行上下文，手机直接显示当前卡片，避免高卡片把它挤出视野。
  const target = currentIndex.value === -1 ? props.rows.length - 1 : currentIndex.value
  const index = Math.max(0, target - (compactTable.value ? 0 : 2))
  let pass = 0
  const align = () => {
    if (id !== locateId) return
    table.value?.scrollToRow(index, 'start')
    // 手机卡片首次测量高度后会重算偏移，在后续布局帧同步定位。
    if (compactTable.value && ++pass < 3) locateFrame = requestAnimationFrame(align)
  }
  align()
}

function pauseFollow() {
  locateId++
  cancelAnimationFrame(locateFrame)
  emit('browse')
}

function rowClass({ rowIndex }) {
  if (highlights.value.inStation.has(rowIndex)) return 'current-train'
  return highlights.value.upcoming.has(rowIndex) ? 'upcoming-train' : ''
}

function browseKey(event) {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
    pauseFollow()
  }
}

watch(() => [props.rows, props.tab], locateCurrent, { flush: 'post' })
watch([table, width, height, currentIndex, () => props.follow], () => {
  if (props.follow) locateCurrent()
}, { flush: 'post' })
defineExpose({ locateCurrent })
onBeforeUnmount(() => {
  locateId++
  cancelAnimationFrame(locateFrame)
})
</script>

<template>
  <div
    ref="container"
    class="station-board-table"
    :class="{ 'mobile-board': compactTable }"
    tabindex="0"
    aria-label="车站到发时刻表"
    @wheel.passive="pauseFollow"
    @touchmove.passive="pauseFollow"
    @pointerdown="pauseFollow"
    @keydown="browseKey"
  >
    <el-table-v2
      v-if="rows.length && width && height"
      :key="compactTable ? `mobile-${tab}-${width}` : 'desktop'"
      ref="table"
      :columns="columns"
      :data="rows"
      :width="width"
      :height="height"
      :row-height="48"
      :estimated-row-height="compactTable ? estimatedMobileHeight : undefined"
      :header-height="compactTable ? 0 : 48"
      :row-class="rowClass"
      :cache="8"
      row-key="id"
      fixed
    >
      <template v-if="compactTable" #row="{ rowData, rowIndex }">
        <StationBoardMobileRow
          :row="rowData"
          :fields="mobileFields"
          :source="source"
          :date="date"
          :current="highlights.highlighted.has(rowIndex)"
          :in-station="highlights.inStation.has(rowIndex)"
        />
      </template>
    </el-table-v2>
    <el-empty v-else description="本站当天没有该类型的车次" />
  </div>
</template>

<style scoped>
.station-board-table {
  width: 100%;
  height: clamp(320px, 60dvh, 720px);
  min-width: 0;
}
.station-board-table :deep(.board-cell) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.station-board-table :deep(.current-train) {
  --board-highlight-color: var(--app-warning, #975009);
  background: var(--el-color-warning-light-9);
  box-shadow: inset 3px 0 0 var(--el-color-warning);
}
.station-board-table :deep(.upcoming-train) {
  --board-highlight-color: var(--app-success, #18763b);
  background: var(--el-color-success-light-9);
  box-shadow: inset 3px 0 0 var(--el-color-success);
}
.station-board-table :deep(.current-train),
.station-board-table :deep(.upcoming-train) {
  color: var(--el-text-color-primary);
  font-weight: 600;
}
.station-board-table :deep(.current-train span.board-cell),
.station-board-table :deep(.upcoming-train span.board-cell) {
  color: var(--board-highlight-color);
}
.mobile-board :deep(.el-table-v2__row) {
  align-items: stretch;
}
.station-board-table :deep(.board-link) {
  color: var(--el-color-primary);
  text-decoration: none;
}
.station-board-table :deep(.board-link:hover) {
  text-decoration: underline;
}
</style>
