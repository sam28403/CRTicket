<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { trainQueryRange } from '@/utils/trainQueryDate.js'
import { demoTrain } from './demoTrain.js'

const result = demoTrain
const train = 'V3888'
const date = ref(trainQueryRange().today)
let dateTimer
const refreshDate = () => { date.value = trainQueryRange().today }
onMounted(() => {
  refreshDate()
  dateTimer = window.setInterval(refreshDate, 60000)
})
onBeforeUnmount(() => window.clearInterval(dateTimer))
</script>

<template>
  <div class="train-preview">
    <div class="page-heading"><h3>车次查询</h3></div>
    <el-card shadow="never">
      <el-form inert class="query-form" label-position="top" @submit.prevent="refreshDate">
        <el-form-item label="车次">
          <el-input :model-value="train" readonly />
        </el-form-item>
        <el-form-item label="始发日期">
          <el-date-picker
            :model-value="date"
            type="date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            readonly
            :clearable="false"
          />
        </el-form-item>
        <el-form-item class="query-action">
          <el-button type="primary" native-type="submit">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <el-card shadow="never" class="results">
      <div class="result-heading">
        <strong>{{ result.train }}　<span class="station-name">{{ result.from }}</span> → <span class="station-name">{{ result.to }}</span></strong>
      </div>
<el-table class="desktop-stops" :data="result.stops" stripe border style="width: 100%">
            <el-table-column prop="no" label="站序" width="70" align="center" />
            <el-table-column prop="train" label="车次" min-width="100" />
            <el-table-column prop="station" label="站名" min-width="120">
              <template #default="{ row }"><span class="station-name">{{ row.station }}</span></template>
            </el-table-column>
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
                <strong>
                  <span class="stop-number">{{ stop.no }}</span>
                  <span class="station-name">{{ stop.station }}</span>
                </strong>
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
          
    </el-card>
  </div>
</template>

<style scoped>
@import './trainPreview.css';
.train-preview { min-width: 0; text-align: left; }
.page-heading h3 { margin: 0; font-size: 22px; font-weight: 500; }
.station-name { color: var(--el-color-primary); }
.query-form { gap: 12px 20px; }
.query-form .el-form-item { width: 200px; }
.query-form .query-action { width: auto; }
.result-heading strong { overflow-wrap: anywhere; }
.stop-details { text-align: left; }
@media (max-width: 600px) {
  .query-form .el-form-item { width: 100%; }
  .query-action :deep(.el-form-item__content),
  .query-action .el-button { width: 100%; }
  .query-form { gap: 0; }
}
</style>
