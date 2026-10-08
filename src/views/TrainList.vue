<script setup>
import { computed, h, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { RouterLink } from 'vue-router'
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
const { width, height } = useElementSize(tableContainer)
const compactTable = computed(() => width.value < 600)
const columns = computed(() => {
  // 预留纵向滚动条，列宽总和始终小于容器宽度。
  const available = Math.max(0, width.value - 16)
  const stationWidth = available * 0.18
  const trainWidth = available * 0.20
  const durationWidth = available * 0.16
  const numberWidth = (available - stationWidth * 2 - trainWidth - durationWidth) / 2
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

function sortColumns({ key, order }) {
  sortBy.value = {
    key,
    order: key === 'train' || sortBy.value.key !== key ? 'asc' : order,
  }
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
      </div>
      <el-card shadow="never" class="results">
        <div class="result-heading">
          <el-text v-if="result">
            {{ result.date }} 始发 · 共 {{ result.total.toLocaleString() }} 趟 · 路路通 {{ result.version }}
          </el-text>
          <el-text v-else>{{ date }} 始发 · 路路通离线时刻表</el-text>
          <el-button :loading="loading" @click="query">刷新</el-button>
        </div>
        <el-text type="info" size="small">
          按离线库的生效日期与开行规则筛选；日期不限，所选日期使用当前版本数据。
          排序：G、D、C、S、Z、T、K、L、普车，其他车次列在末尾。
        </el-text>
        <p class="sort-hint">
          <el-text type="info" size="small">
            点击历时、里程或均速表头切换升降序，点击车次恢复默认顺序。
            均速按总里程 ÷ 全程历时计算，包含停站时间。
          </el-text>
        </p>
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
  min-height: 100vh;
  color: var(--el-text-color-primary);
}
.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 50px;
  padding: 5px 15px;
  background: var(--app-surface, rgb(10 10 0 / 0.1));
}
.query-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}
.page-heading,
.heading-controls,
.result-heading {
  display: flex;
  align-items: center;
  gap: 16px;
}
.page-heading,
.result-heading {
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.heading-controls {
  flex-wrap: wrap;
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 500;
}
.results {
  min-height: 280px;
}
.query-message {
  margin-top: 16px;
}
.sort-hint {
  margin: 8px 0 0;
}
.table-container {
  width: 100%;
  height: clamp(300px, calc(100dvh - 280px), 850px);
  margin-top: 20px;
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
    padding: 20px 12px;
  }
  .heading-controls {
    gap: 12px;
  }
  .results :deep(.el-card__body) {
    padding: 12px 8px;
  }
}
</style>
