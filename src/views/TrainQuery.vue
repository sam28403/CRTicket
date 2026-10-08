<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import ThemeSelect from '@/components/ThemeSelect.vue'
import AppBrand from '@/components/AppBrand.vue'
import api from '@/api.js'
import { isTrainQueryDateInRange, trainQueryRange } from '@/utils/trainQueryDate.js'
import { displayTrainCode, trainInfoForDisplay } from '@/utils/trainDisplay.js'

const train = ref('')
const date = ref(trainQueryRange().today)
const loading = ref(false)
const exporting = ref(false)
const error = ref('')
const result = ref(null)
const route = useRoute()
const offlineMode = computed(() => route.query.source === 'llt')
const offlineRecord = ref('')
let controller
let requestId = 0

async function exportData() {
  if (!result.value?.stops.length || exporting.value) return
  const snapshot = result.value
  exporting.value = true
  try {
    const { downloadTrainInfoPdf } = await import('@/utils/trainInfoPdf.js')
    await downloadTrainInfoPdf(snapshot)
  } catch (err) {
    ElMessage.error(err.message || '导出失败，请稍后重试')
  } finally {
    exporting.value = false
  }
}

function disabledDate(value) {
  if (offlineMode.value) return false
  const localDate = [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-')
  return !isTrainQueryDateInRange(localDate)
}

async function query() {
  if (loading.value) return
  const entered = train.value.trim().toUpperCase()
  const code = offlineMode.value && offlineRecord.value && entered === displayTrainCode(offlineRecord.value)
    ? offlineRecord.value
    : entered
  const validCode = offlineMode.value
    ? /^[A-Z]?\d{1,5}[A-Z]?(?:\/[A-Z]?\d{1,5}[A-Z]?)*$/.test(code) && code.length <= 40
    : /^[A-Z]?\d{1,5}$/.test(code)
  if (!validCode || !date.value) {
    ElMessage.warning('请输入完整车次并选择始发日期')
    return
  }
  if (!offlineMode.value && !isTrainQueryDateInRange(date.value)) {
    ElMessage.warning('请选择今天前 2 天至后 15 天内的始发日期')
    return
  }
  if (offlineMode.value) offlineRecord.value = code
  train.value = displayTrainCode(code)
  loading.value = true
  error.value = ''
  result.value = null
  controller = new AbortController()
  const id = ++requestId
  try {
    const { data } = await api.get(offlineMode.value ? '/llt-trains/detail' : '/train-info', {
      params: { train: code, date: date.value },
      timeout: 45000,
      signal: controller.signal,
    })
    if (!data.success) throw new Error(data.message || '查询失败')
    if (id === requestId) result.value = trainInfoForDisplay(data)
  } catch (err) {
    if (id === requestId && err.code !== 'ERR_CANCELED') {
      error.value = err.response?.data?.message || (
        err.code === 'ECONNABORTED'
          ? '查询超时，请稍后重试'
          : '查询失败，请确认后端服务已启动后重试'
      )
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(
  () => [route.query.train, route.query.date, route.query.source],
  ([code, selectedDate]) => {
    controller?.abort()
    requestId++
    loading.value = false
    result.value = null
    error.value = ''
    const record = typeof code === 'string' ? code.trim().toUpperCase() : ''
    offlineRecord.value = offlineMode.value ? record : ''
    train.value = displayTrainCode(record)
    date.value = typeof selectedDate === 'string' ? selectedDate : trainQueryRange().today
    if (train.value && /^\d{4}-\d{2}-\d{2}$/.test(date.value)) query()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  requestId++
  controller?.abort()
})
</script>

<template>
  <div class="train-query-page">
    <el-header class="top-header">
      <AppBrand />
      <div class="page-header-actions"><ThemeSelect /></div>
    </el-header>
    <main class="query-content">
      <div class="page-heading">
        <h1>车次查询</h1>
        <el-button type="info" @click="$router.push('/list')">
          车次列表
        </el-button>
      </div>
      <el-card shadow="never">
        <el-form class="query-form" label-position="top" :disabled="loading" @submit.prevent="query">
          <el-form-item label="车次">
            <el-input
              v-model="train"
              :placeholder="offlineMode ? '输入离线库中的完整车次' : '例如 G1、D3068、1461'"
              clearable
              :maxlength="offlineMode ? 40 : 6"
            />
          </el-form-item>
          <el-form-item label="始发日期">
            <el-date-picker
              v-model="date"
              type="date"
              value-format="YYYY-MM-DD"
              :disabled-date="disabledDate"
              :editable="false"
              :clearable="false"
            />
          </el-form-item>
          <el-form-item class="query-action">
            <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
          </el-form-item>
        </el-form>
        <el-text type="info" size="small">
          {{ offlineMode
            ? '当前显示路路通离线时刻表，日期按始发当天选择，不限制日期，使用当前离线库版本。'
            : '日期按列车从始发站出发当天选择，可查询今天前 2 天至后 15 天。' }}
        </el-text>
      </el-card>

      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="query-message" />
      <el-card v-loading="loading" shadow="never" class="results" element-loading-text="正在查询车次…">
        <el-alert
          v-for="warning in result?.warnings || []"
          :key="warning"
          :title="warning"
          type="info"
          :closable="false"
          show-icon
          class="query-message"
        />
        <template v-if="result?.stops.length">
          <div class="result-heading">
            <strong>{{ result.train }}　{{ result.from }} → {{ result.to }}</strong>
            <el-text type="info" size="small">
              查询日期：{{ result.date }}；车站数据：{{ result.source }}；车站数量：{{ result.stops.length }} 站；
              <template v-if="result.mileageVersion"> 里程数据来源：路路通 {{ result.mileageVersion }}</template>
            </el-text>
          </div>
          <el-table class="desktop-stops" :data="result.stops" stripe border style="width: 100%">
            <el-table-column prop="no" label="站序" width="70" align="center" />
            <el-table-column prop="train" label="车次" min-width="100" />
            <el-table-column prop="station" label="站名" min-width="120" />
            <el-table-column label="到达时间" min-width="150">
              <template #default="{ row, $index }">
                {{ $index === 0 ? '始发站' : row.arrival || '—' }}
                <el-tag
                  v-if="$index > 0 && row.arrival && row.arrivalDay > 0"
                  size="small"
                  effect="plain"
                  class="arrival-day"
                >
                  +{{ row.arrivalDay }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="出发时间" min-width="100">
              <template #default="{ row, $index }">
                {{ $index === result.stops.length - 1 ? '终到站' : row.departure || '—' }}
              </template>
            </el-table-column>
            <el-table-column label="停留时长" min-width="100">
              <template #default="{ row }">{{ row.stay == null ? '—' : `${row.stay} 分钟` }}</template>
            </el-table-column>
            <el-table-column label="里程（km）" min-width="110">
              <template #default="{ row }">{{ row.mileage ?? '暂无' }}</template>
            </el-table-column>
          </el-table>
          <ol class="mobile-stops" aria-label="列车经停信息">
            <li v-for="(stop, index) in result.stops" :key="`${stop.no}-${index}`" class="mobile-stop">
              <div class="stop-heading">
                <strong><span class="stop-number">{{ stop.no }}</span>{{ stop.station }}</strong>
                <el-text size="small">{{ stop.train }}</el-text>
              </div>
              <dl class="stop-details">
                <div>
                  <dt>到达时间</dt>
                  <dd>
                    {{ index === 0 ? '始发站' : stop.arrival || '—' }}
                    <el-tag
                      v-if="index > 0 && stop.arrival && stop.arrivalDay > 0"
                      size="small"
                      effect="plain"
                      class="arrival-day"
                    >
                      +{{ stop.arrivalDay }}
                    </el-tag>
                  </dd>
                </div>
                <div><dt>出发时间</dt><dd>{{ index === result.stops.length - 1 ? '终到站' : stop.departure || '—' }}</dd></div>
                <div><dt>停留时长</dt><dd>{{ stop.stay == null ? '—' : `${stop.stay} 分钟` }}</dd></div>
                <div><dt>里程</dt><dd>{{ stop.mileage == null ? '暂无' : `${stop.mileage} km` }}</dd></div>
              </dl>
            </li>
          </ol>
          <div class="export-actions">
            <el-button type="primary" :loading="exporting" :disabled="loading" @click="exportData">导出数据</el-button>
          </div>
        </template>
        <el-empty
          v-else
          :description="loading
            ? '正在获取时刻表'
            : error
              ? '查询未完成，请重试'
              : result
                ? '该日期未查询到此车次'
                : '输入车次和始发日期查询时刻表'"
        />
      </el-card>
    </main>
  </div>
</template>

<style scoped>
.train-query-page {
  min-height: 100vh;
  color: var(--el-text-color-primary);
}
.top-header {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 50px;
  padding: 5px 15px;
  background: var(--app-surface, rgb(10 10 0 / 0.1));
}
.top-header h2 {
  margin: 0;
  font-family: 'Roboto', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 20px;
}
.query-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}
.page-heading, .result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
h1 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-size: 22px;
  font-weight: 500;
}
.query-form {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  flex-wrap: wrap;
}
.query-form .el-form-item {
  width: 240px;
  margin-bottom: 16px;
}
.query-form .query-action {
  width: auto;
}
.query-form :deep(.el-date-editor) {
  width: 100%;
}
.results {
  margin-top: 20px;
  min-height: 280px;
}
.query-message {
  margin: 16px 0;
}
.arrival-day {
  margin-left: 6px;
}
.export-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
.mobile-stops {
  display: none;
}
@media (max-width: 800px) {
  .desktop-stops {
    display: none;
  }
  .mobile-stops {
    display: block;
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .mobile-stop {
    padding: 16px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
  .mobile-stop:first-child {
    padding-top: 0;
  }
  .stop-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .stop-heading strong {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .stop-heading > :last-child {
    flex-shrink: 0;
  }
  .stop-number {
    color: var(--el-text-color-secondary);
    font-weight: normal;
    margin-right: 10px;
  }
  .stop-details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 16px;
    margin: 12px 0 0;
  }
  .stop-details dt {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin-bottom: 4px;
  }
  .stop-details dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .result-heading {
    overflow-wrap: anywhere;
  }
}
@media (max-width: 600px) {
  .top-header h2 {
    font-size: 15px;
  }
  .query-content {
    padding: 20px 12px;
  }
  .query-form {
    gap: 0;
  }
  .query-form .el-form-item {
    width: 100%;
  }
  .query-action :deep(.el-button) {
    width: 100%;
  }
  .results :deep(.el-card__body) {
    padding: 16px;
  }
  .export-actions .el-button {
    width: 100%;
  }
}
</style>
