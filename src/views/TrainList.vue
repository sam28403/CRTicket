<script setup>
import { computed, h, onActivated, onBeforeUnmount, onDeactivated, ref, shallowRef, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { onBeforeRouteLeave, RouterLink } from 'vue-router'
import AppBrand from '@/components/AppBrand.vue'
import ThemeSelect from '@/components/ThemeSelect.vue'
import api from '@/api.js'
import { trainQueryRange } from '@/utils/trainQueryDate.js'

defineOptions({ name: 'TrainList' })

const date = ref(trainQueryRange().today)
const loading = ref(false)
const error = ref('')
const result = shallowRef(null)
const sortBy = ref({ key: 'train', order: 'asc' })
const rows = computed(() => (result.value?.trains || []).map(row => {
  const parts = row.duration?.split(':').map(Number)
  const durationMinutes = parts?.length === 2 && parts.every(Number.isFinite)
    ? parts[0] * 60 + parts[1]
    : null
  const speed = row.mileage != null && durationMinutes > 0
    ? row.mileage * 60 / durationMinutes
    : null
  return { ...row, durationMinutes, speed }
}))
const sortedRows = computed(() => {
  const { key, order } = sortBy.value
  // 原始摘要已按车次类别排序，恢复默认时直接复用，避免额外排序。
  if (key === 'train') return rows.value
  const field = key === 'duration' ? 'durationMinutes' : key
  const direction = order === 'asc' ? 1 : -1
  return [...rows.value].sort((a, b) => {
    const left = a[field]
    const right = b[field]
    // 升降序都把缺失值放在末尾；相同值保留原有车次顺序。
    if (left == null) return right == null ? 0 : 1
    if (right == null) return -1
    return (left - right) * direction
  })
})
const tableContainer = ref(null)
const table = ref(null)
const scrollTop = ref(0)
let active = true
let restoringScroll = false
let restoreFrame
const { width, height } = useElementSize(tableContainer)
const compactTable = computed(() => width.value < 600)
const columns = computed(() => {
  // 预留纵向滚动条，列宽总和始终小于容器宽度。
  const available = Math.max(0, width.value - 16)
  const stationWidth = available * 0.18
  const trainWidth = available * 0.14
  const stationCountWidth = available * 0.06
  const durationWidth = available * 0.16
  const numberWidth = (available - stationWidth * 2 - trainWidth - stationCountWidth - durationWidth) / 2
  const textCell = ({ cellData }) => h('span', { class: 'cell-text' }, cellData ?? '暂无')
  const unitHeader = (title, unit) => () => h('span', { class: 'unit-heading' }, [
    h('span', title),
    h('small', unit),
  ])
  return [
    {
      key: 'train',
      dataKey: 'train',
      title: '车次',
      width: trainWidth,
      sortable: true,
      cellRenderer: ({ cellData }) => h(RouterLink, {
        class: 'cell-text train-link',
        to: {
          path: '/train',
          query: {
            train: cellData,
            date: result.value.date,
            source: 'llt',
          },
        },
      }, () => cellData),
    },
    {
      key: 'from',
      dataKey: 'from',
      title: '始发站',
      width: stationWidth,
      cellRenderer: textCell,
    },
    {
      key: 'to',
      dataKey: 'to',
      title: '终到站',
      width: stationWidth,
      cellRenderer: textCell,
    },
    {
      key: 'duration',
      dataKey: 'duration',
      title: '历时',
      width: durationWidth,
      sortable: true,
      cellRenderer: textCell,
    },
    {
      key: 'stationCount',
      dataKey: 'stationCount',
      title: '车站数量',
      width: stationCountWidth,
      headerCellRenderer: () => compactTable.value
        ? h('span', { class: 'cell-text' }, '站数')
        : h('span', { class: 'unit-heading' }, [
          h('span', '车站'),
          h('span', '数量'),
        ]),
      cellRenderer: textCell,
    },
    {
      key: 'mileage',
      dataKey: 'mileage',
      title: '总里程（km）',
      width: numberWidth,
      sortable: true,
      headerCellRenderer: unitHeader('里程', 'km'),
      cellRenderer: textCell,
    },
    {
      key: 'speed',
      dataKey: 'speed',
      title: '均速（km/h）',
      width: numberWidth,
      sortable: true,
      headerCellRenderer: unitHeader('均速', 'km/h'),
      cellRenderer: ({ cellData }) => textCell({
        cellData: cellData == null ? null : cellData.toFixed(1),
      }),
    },
  ].map(column => ({ ...column, align: 'center' }))
})
let controller
let requestId = 0

function rememberScroll({ scrollTop: top }) {
  if (active && !restoringScroll) scrollTop.value = top
}

function restoreScroll() {
  if (!active || !table.value || !width.value || !height.value) return
  cancelAnimationFrame(restoreFrame)
  restoringScroll = true
  table.value.scrollToTop(scrollTop.value)
  // 等虚拟表格完成重建与滚动同步，避免初始的 0 覆盖离开前的位置。
  restoreFrame = requestAnimationFrame(() => {
    table.value?.scrollToTop(scrollTop.value)
    restoreFrame = requestAnimationFrame(() => { restoringScroll = false })
  })
}

// 缓存页面重新插入时尺寸会变化，虚拟表格也可能重建。
watch([table, width, height], restoreScroll, { flush: 'post' })
onActivated(() => {
  active = true
  restoreScroll()
})
onBeforeRouteLeave(() => { active = false })
onDeactivated(() => { active = false })

function sortColumns({ key, order }) {
  sortBy.value = {
    key,
    order: key === 'train' || sortBy.value.key !== key ? 'asc' : order,
  }
  scrollTop.value = 0
  table.value?.scrollToTop(0)
}

async function query() {
  controller?.abort()
  const id = ++requestId
  controller = new AbortController()
  const selectedDate = date.value
  loading.value = true
  error.value = ''
  result.value = null
  scrollTop.value = 0
  table.value?.scrollToTop(0)
  try {
    const { data } = await api.get('/llt-trains', {
      params: { date: selectedDate },
      timeout: 45000,
      signal: controller.signal,
    })
    if (!data.success) throw new Error(data.message || '读取失败')
    if (id === requestId) result.value = data
  } catch (err) {
    if (id === requestId && err.code !== 'ERR_CANCELED') {
      error.value = err.response?.data?.message || (
        err.code === 'ECONNABORTED'
          ? '读取超时，请稍后重试'
          : '读取失败，请确认后端服务已启动后重试'
      )
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(date, query, { immediate: true })
onBeforeUnmount(() => {
  cancelAnimationFrame(restoreFrame)
  requestId++
  controller?.abort()
})
</script>

<template>
  <div class="train-list-page">
    <el-header class="top-header">
      <AppBrand />
      <ThemeSelect />
    </el-header>
    <main class="query-content">
      <div class="page-heading">
        <div class="heading-controls">
          <h1>车次列表</h1>
          <el-date-picker
            v-model="date"
            type="date"
            value-format="YYYY-MM-DD"
            :editable="false"
            :clearable="false"
            aria-label="始发日期"
          />
        </div>
        <div class="result-summary">
          <el-text v-if="result">
            {{ result.date }} 始发 · 共 {{ result.total.toLocaleString() }} 趟 · 路路通 {{ result.version }}
          </el-text>
          <el-text v-else>{{ date }} 始发 · 路路通离线时刻表</el-text>
          <el-text type="info" size="small">
            按离线库的生效日期与开行规则筛选；日期不限，所选日期使用当前版本数据。
            排序：G、D、C、S、Z、T、K、L、普车，其他车次列在末尾。
          </el-text>
          <el-text type="info" size="small">
            点击历时、里程或均速表头切换升降序，点击车次恢复默认顺序。
            均速按总里程 ÷ 全程历时计算，包含停站时间。
          </el-text>
        </div>
        <el-button :loading="loading" @click="query">刷新</el-button>
      </div>
      <el-card shadow="never" class="results">
        <el-alert
          v-if="error"
          :title="error"
          type="error"
          show-icon
          :closable="false"
          class="query-message"
        />
        <div
          ref="tableContainer"
          v-loading="loading"
          class="table-container"
          element-loading-text="正在读取离线时刻表…"
        >
          <el-table-v2
            v-if="result?.trains.length && width && height"
            ref="table"
            :class="{
              'compact-table': compactTable,
              'narrow-table': width < 300,
            }"
            :columns="columns"
            :data="sortedRows"
            :sort-by="sortBy"
            :width="width"
            :height="height"
            :row-height="compactTable ? 60 : 48"
            :header-height="48"
            row-key="train"
            fixed
            @column-sort="sortColumns"
            @scroll="rememberScroll"
          />
          <el-empty
            v-else
            :description="loading
              ? '正在获取车次列表'
              : error
                ? '读取未完成，请刷新重试'
                : '离线库中没有该日期开行的车次'"
          />
        </div>
      </el-card>
    </main>
  </div>
</template>

<style scoped>
.train-list-page {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  color: var(--el-text-color-primary);
}
.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 50px;
  flex-shrink: 0;
  padding: 5px 15px;
  background: var(--app-surface, rgb(10 10 0 / 0.1));
}
.query-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  width: 100%;
  max-width: 1248px;
  margin: 0 auto;
  padding: 24px;
  gap: 16px;
}
.page-heading,
.heading-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}
.page-heading {
  justify-content: space-between;
  flex-shrink: 0;
}
.heading-controls {
  flex-shrink: 0;
  flex-wrap: wrap;
}
.result-summary {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 4px;
  line-height: 1.4;
}
.result-summary .el-text {
  align-self: stretch;
}
.page-heading > .el-button {
  flex-shrink: 0;
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 500;
}
.results {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.results :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.query-message {
  flex-shrink: 0;
  margin-bottom: 12px;
}
.table-container {
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.table-container > .el-empty {
  box-sizing: border-box;
  height: 100%;
  padding: 0;
}
.table-container :deep(.cell-text) {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.4;
}
.table-container :deep(.train-link) {
  color: var(--el-color-primary);
  text-decoration: none;
}
.table-container :deep(.train-link:hover),
.table-container :deep(.train-link:focus-visible) {
  text-decoration: underline;
}
.table-container :deep(.unit-heading) {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.table-container :deep(.unit-heading small) {
  font-size: 10px;
  font-weight: normal;
  color: var(--el-text-color-secondary);
}
.table-container :deep(.compact-table .el-table-v2__row-cell),
.table-container :deep(.compact-table .el-table-v2__header-cell) {
  padding: 0 3px;
  font-size: 12px;
}
.table-container :deep(.compact-table .el-table-v2__header-cell-text) {
  min-width: 0;
  white-space: normal;
}
.table-container :deep(.compact-table .el-table-v2__sort-icon) {
  margin-left: 2px;
  font-size: 10px;
  flex-shrink: 0;
}
.table-container :deep(.narrow-table .el-table-v2__row-cell) {
  padding: 0 2px;
}
.table-container :deep(.narrow-table .el-table-v2__header-cell) {
  padding: 0 2px;
  font-size: 11px;
}
@media (max-width: 600px) {
  .query-content {
    padding: 12px;
    gap: 12px;
  }
  .page-heading {
    flex-wrap: wrap;
    gap: 12px;
  }
  .result-summary {
    flex-basis: 100%;
    order: 1;
  }
  .heading-controls :deep(.el-date-editor) {
    width: 160px;
  }
  .heading-controls {
    gap: 12px;
  }
  .results :deep(.el-card__body) {
    padding: 12px 8px;
  }
}
</style>
