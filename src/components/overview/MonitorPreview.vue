<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import LeftTicketCard from '@/components/LeftTicketCard.vue'
import { hasAvailableSeat } from '@/utils/seatAvailability.js'
import { matchesDepartureTime } from '@/utils/trainTime.js'
import { monitorColumns, monitorTrains } from './demoMonitor.js'
import { useTheme } from '@/composables/useTheme.js'

const { isDark } = useTheme()
const tomorrow = () => new Date(Date.now() + 8 * 3600000 + 86400000).toISOString().slice(0, 10)
const date = ref(tomorrow())
const interval = ref(60)
const monitoring = ref(false)
const departures = ref(['北京'])
const arrivals = ref(['上海'])
const departureOptions = ['北京南', '北京', '北京丰台']
const arrivalOptions = ['上海虹桥', '上海', '上海松江', '上海南']
const timeRange = ref([0, 24])
const trainFilter = ref('')
const seats = ref([])
const onlyAvailable = ref(false)
const timeMarks = { 0: '0点', 6: '6点', 12: '12点', 18: '18点', 24: '24点' }
const formatHour = value => `${String(value).padStart(2, '0')}:00`
const visibleColumns = computed(() => monitorColumns.filter(([key]) =>
  !seats.value.length || seats.value.includes(key)))
const filtered = computed(() => monitorTrains.filter(row => {
  const matchesStations = (!departures.value.length || departures.value.includes(row.from))
    && (!arrivals.value.length || arrivals.value.includes(row.to))
  const matchesTrain = !trainFilter.value || row.train.includes(trainFilter.value.trim().toUpperCase())
  const hasTicket = visibleColumns.value.some(([key]) => hasAvailableSeat(row.seats[key]))
  return matchesStations && matchesTrain && matchesDepartureTime(row.departure, timeRange.value)
    && (!onlyAvailable.value || hasTicket)
}).slice(0, 4))
let timer
const refresh = () => { date.value = tomorrow() }
onMounted(() => { timer = window.setInterval(refresh, 60000) })
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="monitor-preview" :class="{ 'dark-preview': isDark }">
    <header class="page-heading"><h3>余票查询与监控</h3></header>
    <el-card shadow="never">
      <el-form inert label-position="top" @submit.prevent="refresh">
        <div class="form-grid">
          <div class="station-route-fields">
            <el-form-item label="出发站"><el-input model-value="北京" readonly /></el-form-item>
            <span class="route-arrow" aria-hidden="true">→</span>
            <el-form-item label="到达站"><el-input model-value="上海" readonly /></el-form-item>
          </div>
          <el-form-item label="出发日期">
            <el-date-picker
              :model-value="date"
              type="date"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              readonly
              :clearable="false"
            />
          </el-form-item>
          <el-form-item label="监控间隔（秒）">
            <el-input-number v-model="interval" :min="10" :max="3600" :step="10" :disabled="monitoring" />
          </el-form-item>
        </div>
        <div class="actions">
          <el-button type="primary" native-type="submit">查询余票</el-button>
          <el-button type="success" :disabled="monitoring" @click="monitoring = true">
            {{ monitoring ? '监控中' : '开始监控' }}
          </el-button>
          <el-button :disabled="!monitoring" @click="monitoring = false">停止</el-button>
        </div>
      </el-form>
    </el-card>

    <section class="station-filters" aria-label="车站筛选" inert>
      <div class="station-filter-row">
        <strong>出发车站：</strong>
        <button class="all-stations-button" :class="{ active: !departures.length }" @click="departures = []">全部</button>
        <el-checkbox-group v-model="departures">
          <el-checkbox v-for="station in departureOptions" :key="station" :value="station">
            {{ station }}
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <div class="station-filter-row">
        <strong>到达车站：</strong>
        <button class="all-stations-button" :class="{ active: !arrivals.length }" @click="arrivals = []">全部</button>
        <el-checkbox-group v-model="arrivals">
          <el-checkbox v-for="station in arrivalOptions" :key="station" :value="station">
            {{ station }}
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <div class="time-filter-row">
        <strong>出发时间：</strong>
        <span>{{ formatHour(timeRange[0]) }}–{{ formatHour(timeRange[1]) }}</span>
        <el-slider
          v-model="timeRange"
          range
          show-stops
          :min="0"
          :max="24"
          :marks="timeMarks"
          :format-tooltip="formatHour"
          aria-label="出发时间范围"
        />
      </div>
    </section>

    <section class="results">
      <div class="result-header">
        <h3>查询结果</h3>
        <div class="filters" inert>
          <el-input v-model="trainFilter" placeholder="筛选车次" aria-label="筛选车次" clearable />
          <el-select v-model="seats" multiple clearable collapse-tags placeholder="全部席别" aria-label="筛选席别">
            <el-option v-for="[key, label] in monitorColumns" :key="key" :label="label" :value="key" />
          </el-select>
          <el-checkbox v-model="onlyAvailable">仅看有票</el-checkbox>
        </div>
      </div>
      <div v-if="filtered.length" class="ticket-grid">
        <LeftTicketCard
          v-for="row in filtered"
          :key="row.id"
          :train="row"
          :columns="visibleColumns"
          :show-seat-source="false"
        />
      </div>
      <el-empty v-else description="没有符合筛选条件的车次" />
    </section>
  </div>
</template>

<style scoped src="./monitorPreview.css"></style>
