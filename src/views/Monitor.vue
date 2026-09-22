<script setup>
import ThemeSelect from '@/components/ThemeSelect.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import api from '@/api.js'
import LeftTicketCard from '@/components/LeftTicketCard.vue'
import { queryStationSearch, stations } from '@/composables/useTicketShared.js'

const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)

const from = ref('')
const to = ref('')
const selectedDepartureStations = ref([])
const selectedArrivalStations = ref([])
const date = ref(today())
const interval = ref(60)
const trainFilters = ref([])
const seatFilter = ref('')
const timeRange = ref([0, 24])
const onlyAvailable = ref(false)
const highSpeedOnly = ref(false)
const ordinaryOnly = ref(false)
const monitoring = ref(false)
const loading = ref(false)
const rows = ref([])
const queriedAt = ref('')
const error = ref('')
const nextAt = ref('')
const events = ref([])
const columns = [
  ['second', '二等座'],
  ['first', '一等座'],
  ['premiumSleeper', '优选一等座'],
  ['business', '商务座'],
  ['premium', '特等座'],
  ['advancedSleeper', '高级软卧'],
  ['softSleeper', '软卧 / 动卧'],
  ['hardSleeper', '硬卧'],
  ['softSeat', '软座'],
  ['hardSeat', '硬座'],
  ['standing', '无座'],
  ['other', '其他'],
]
const timeMarks = {
  0: '0点',
  6: '6点',
  12: '12点',
  18: '18点',
  24: '24点',
}

let timer
let controller
let generation = 0
let previous = new Map()

const departureStations = computed(() =>
  Array.from(new Set(rows.value.map((row) => row.from))).filter(Boolean)
)

const arrivalStations = computed(() =>
  Array.from(new Set(rows.value.map((row) => row.to))).filter(Boolean)
)

const available = (value) =>
  value === '有' ||
  value === '>20' ||
  (/^\d+$/.test(value) && Number(value) > 0)

function isOrdinaryTrain(trainNo) {
  const normalized = String(trainNo || '').trim().toUpperCase()
  if (/^(?:[ZTKL]\d+|\d+)$/.test(normalized)) return true

  const dTrain = normalized.match(/^D(\d+)$/)
  if (dTrain) {
    const number = Number(dTrain[1])
    return (number >= 1 && number <= 300) || (number >= 701 && number <= 800)
  }

  const cTrain = normalized.match(/^C(\d+)$/)
  if (cTrain) {
    const number = Number(cTrain[1])
    return (number >= 1 && number <= 999) || (number >= 4001 && number <= 4999)
  }

  return false
}

function matches(row) {
  const wantedTrains = trainFilters.value.map((value) => value.trim().toUpperCase())
  const matchesTrainNumber =
    !wantedTrains.length || wantedTrains.includes(row.train.toUpperCase())
  const ordinary = isOrdinaryTrain(row.train)
  const matchesTrainType =
    (!highSpeedOnly.value && !ordinaryOnly.value) ||
    (highSpeedOnly.value && !ordinary) ||
    (ordinaryOnly.value && ordinary)
  const matchesDeparture =
    !selectedDepartureStations.value.length ||
    selectedDepartureStations.value.includes(row.from)
  const matchesArrival =
    !selectedArrivalStations.value.length ||
    selectedArrivalStations.value.includes(row.to)
  const [departureHour, departureMinute] = row.departure
    .split(':')
    .map(Number)
  const departureMinutes = departureHour * 60 + departureMinute
  const [startHour, endHour] = timeRange.value
  const matchesTime =
    departureMinutes >= startHour * 60 && departureMinutes < endHour * 60

  return (
    matchesTrainNumber &&
    matchesTrainType &&
    matchesDeparture &&
    matchesArrival &&
    matchesTime
  )
}

const hasTicket = (row) =>
  row.canBuy &&
  (seatFilter.value
    ? available(row.seats[seatFilter.value])
    : Object.values(row.seats).some(available))

const filtered = computed(() =>
  rows.value.filter((row) => matches(row) && (!onlyAvailable.value || hasTicket(row)))
)

const ticketCount = computed(
  () => rows.value.filter((row) => matches(row) && hasTicket(row)).length
)

const time = (value) =>
  value
    ? new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
    : '—'

function disabledDate(value) {
  const key = [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-')
  const end = new Date(Date.now() + 8 * 3600000 + 14 * 86400000)
    .toISOString()
    .slice(0, 10)
  return key < today() || key > end
}

function selectTrainType(type, enabled) {
  if (!enabled) return
  if (type === 'highSpeed') ordinaryOnly.value = false
  if (type === 'ordinary') highSpeedOnly.value = false
}

function swapStations() {
  const oldFrom = from.value
  from.value = to.value
  to.value = oldFrom
}

const formatHour = (value) => `${String(value).padStart(2, '0')}:00`

async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    ElMessage.warning('当前浏览器不支持系统通知，将继续使用页面内提醒')
    return false
  }

  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') {
    ElMessage.warning('浏览器通知已被禁用，请在网站权限设置中手动开启')
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      ElMessage.success('浏览器通知已开启')
      return true
    }
    ElMessage.warning('未获得通知权限，将继续使用页面内提醒')
  } catch {
    ElMessage.warning('无法申请浏览器通知权限，将继续使用页面内提醒')
  }

  return false
}

function publishBrowserNotification(notices, details) {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return
  }

  const trains = Array.from(new Set(notices))
  const trainSummary = trains.slice(0, 3).join('、')
  const more = trains.length > 3 ? ` 等 ${trains.length} 趟车` : ''
  const body = details.slice(0, 3).join('\n')

  try {
    const notification = new Notification(`余票提醒：${trainSummary}${more}`, {
      body,
      icon: 'Picture1.png',
      tag: 'cr-ticket-availability',
      renotify: true,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch {
    ElMessage.warning('系统通知发送失败，请查看页面内的有票提醒')
  }
}

function stop() {
  monitoring.value = false
  clearTimeout(timer)
  nextAt.value = ''
  generation++
  controller?.abort()
  loading.value = false
}

function reset() {
  stop()
  rows.value = []
  queriedAt.value = ''
  error.value = ''
  events.value = []
  selectedDepartureStations.value = []
  selectedArrivalStations.value = []
  previous = new Map()
}

watch([from, to, date], reset, { flush: 'sync' })
watch(
  [
    trainFilters,
    seatFilter,
    timeRange,
    highSpeedOnly,
    ordinaryOnly,
    selectedDepartureStations,
    selectedArrivalStations,
  ],
  () => {
    previous = new Map()
    events.value = []
  }
)

function parameters() {
  const start = stations.find((station) => station.name === from.value.trim())
  const end = stations.find((station) => station.name === to.value.trim())

  if (!start || !end) throw new Error('请输入并选择有效的出发站和到达站')
  if (start.telecode === end.telecode) throw new Error('出发站和到达站不能相同')
  if (!date.value) throw new Error('请选择出发日期')
  return {
    from: start.telecode,
    to: end.telecode,
    date: date.value,
  }
}

async function query(startMonitor = false) {
  if (loading.value) return

  let params
  try {
    params = parameters()
  } catch (queryError) {
    error.value = queryError.message
    return
  }

  clearTimeout(timer)
  if (startMonitor) {
    await requestNotificationPermission()
    monitoring.value = true
    previous = new Map()
  }

  const current = ++generation
  controller = new AbortController()
  loading.value = true
  error.value = ''
  nextAt.value = ''

  try {
    const { data } = await api.get('/left-ticket', {
      params,
      timeout: 25000,
      signal: controller.signal,
    })
    if (current !== generation) return
    if (!data.success || !Array.isArray(data.trains)) {
      throw new Error('后端返回的数据格式错误')
    }

    rows.value = data.trains
    queriedAt.value = data.queriedAt

    const currentTickets = new Map()
    const notices = []
    const noticeDetails = []
    for (const row of rows.value.filter(matches)) {
      const signature = JSON.stringify(
        seatFilter.value ? row.seats[seatFilter.value] : row.seats
      )
      if (!hasTicket(row)) continue

      currentTickets.set(row.id, signature)
      if (monitoring.value && previous.get(row.id) !== signature) {
        const detail = columns
          .filter(
            ([key]) =>
              (!seatFilter.value || key === seatFilter.value) &&
              available(row.seats[key])
          )
          .map(([key, label]) => `${label}：${row.seats[key]}`)
          .join('，')
        const noticeText = `${row.train} ${row.from} → ${row.to}，${detail}`
        events.value.unshift({
          at: queriedAt.value,
          text: noticeText,
        })
        notices.push(row.train)
        noticeDetails.push(noticeText)
      }
    }

    events.value = events.value.slice(0, 30)
    if (notices.length) {
      const summary = notices.slice(0, 3).join('、')
      const more = notices.length > 3 ? ` 等 ${notices.length} 趟车` : ''
      ElMessage.success(`${summary}${more} 有票或余票发生变化，详见有票提醒`)
      publishBrowserNotification(notices, noticeDetails)
    }
    previous = currentTickets
  } catch (queryError) {
    if (current !== generation) return
    error.value =
      queryError.response?.data?.message ||
      (queryError.code === 'ECONNABORTED'
        ? '查询超时，请检查后端连接'
        : queryError.message || '查询失败')
    monitoring.value = false
  } finally {
    if (current === generation) {
      loading.value = false
      if (monitoring.value) {
        const delay = Math.max(10, Number(interval.value) || 60) * 1000
        nextAt.value = new Date(Date.now() + delay).toISOString()
        timer = setTimeout(() => query(), delay)
      }
    }
  }
}

onBeforeUnmount(stop)
</script>

<template>
  <div class="monitor-page">
    <el-header class="top-header">
      <el-avatar src="Picture1.png" />
      <h2>Sam-Lab CR Ticket Maker</h2>
      <div class="page-header-actions"><ThemeSelect /></div>
      </el-header>

    <main class="monitor-content">
      <header class="page-heading">
        <h1>
          余票查询与监控
          <el-tag type="warning">Beta</el-tag>
        </h1>
        <nav class="monitor-navigation" aria-label="页面导航">
          <RouterLink to="/">生成车票</RouterLink>
          <a href="https://www.12306.cn" target="_blank" rel="noopener noreferrer">
            打开 12306 官网 ↗
          </a>
        </nav>
      </header>

      <el-card shadow="never">
        <el-form label-position="top" @submit.prevent="query()">
          <div class="form-grid">
            <div class="station-route-fields">
              <el-form-item label="出发站">
                <el-autocomplete
                  v-model="from"
                  :fetch-suggestions="queryStationSearch"
                  placeholder="站名 / 拼音 / 首字母"
                  clearable
                />
              </el-form-item>

              <div class="swap-stations">
                <el-button circle title="换向" aria-label="交换出发站和到达站" @click="swapStations">
                  <el-icon><Refresh /></el-icon>
                </el-button>
                <span>换向</span>
              </div>

              <el-form-item label="到达站">
                <el-autocomplete
                  v-model="to"
                  :fetch-suggestions="queryStationSearch"
                  placeholder="站名 / 拼音 / 首字母"
                  clearable
                />
              </el-form-item>
            </div>

            <el-form-item label="出发日期">
              <el-date-picker
                v-model="date"
                type="date"
                value-format="YYYY-MM-DD"
                :disabled-date="disabledDate"
                :editable="false"
              />
            </el-form-item>

            <el-form-item label="监控间隔（秒）">
              <el-input-number
                v-model="interval"
                :min="10"
                :max="3600"
                :step="10"
                :disabled="monitoring"
              />
            </el-form-item>
          </div>

          <div class="actions">
            <el-button type="primary" :loading="loading" :disabled="monitoring" @click="query()">
              查询余票
            </el-button>
            <el-button type="success" :disabled="loading || monitoring" @click="query(true)">
              开始监控
            </el-button>
            <el-button :disabled="!monitoring && !loading" @click="stop">停止</el-button>
            <span role="status">
              {{ monitoring ? '监控中' : '未监控' }} · 上次成功：{{ time(queriedAt) }}
              <template v-if="nextAt"> · 下次查询：{{ time(nextAt) }}</template>
            </span>
          </div>
        </el-form>

        <p class="hint">
          成人票 · 今天起 15 天内 · 最短间隔 10 秒。查询后可按实际出发车站和到达车站筛选；监控仅在此页面打开时运行，电脑休眠或后台标签页可能延迟。余票以官网实时结果为准。
        </p>
      </el-card>

      <el-alert
        v-if="error"
        :title="error"
        :description="queriedAt ? '下方保留的是上次成功结果，可能已过期；监控已停止，请手动重试。' : '请检查查询条件、后端服务或官网状态后重试。'"
        type="error"
        show-icon
        :closable="false"
        role="alert"
      />

      <section v-if="rows.length" class="station-filters" aria-label="车站筛选">
        <div class="station-filter-row">
          <strong>出发车站：</strong>
          <button
            type="button"
            class="all-stations-button"
            :class="{ active: !selectedDepartureStations.length }"
            @click="selectedDepartureStations = []"
          >
            全部
          </button>
          <el-checkbox-group v-model="selectedDepartureStations">
            <el-checkbox
              v-for="station in departureStations"
              :key="station"
              :value="station"
            >
              {{ station }}
            </el-checkbox>
          </el-checkbox-group>
        </div>

        <div class="station-filter-row">
          <strong>到达车站：</strong>
          <button
            type="button"
            class="all-stations-button"
            :class="{ active: !selectedArrivalStations.length }"
            @click="selectedArrivalStations = []"
          >
            全部
          </button>
          <el-checkbox-group v-model="selectedArrivalStations">
            <el-checkbox
              v-for="station in arrivalStations"
              :key="station"
              :value="station"
            >
              {{ station }}
            </el-checkbox>
          </el-checkbox-group>
        </div>

        <div class="time-filter-row">
          <strong>出发时间：</strong>
          <span class="time-range-value">
            {{ formatHour(timeRange[0]) }}–{{ formatHour(timeRange[1]) }}
          </span>
          <el-slider
            v-model="timeRange"
            range
            show-stops
            :min="0"
            :max="24"
            :step="1"
            :marks="timeMarks"
            :format-tooltip="formatHour"
            aria-label="出发时间范围"
          />
        </div>
      </section>

      <section class="results">
        <div class="result-header">
          <h2>
            查询结果
            <small>{{ filtered.length }} 趟 · 关注席别有票 {{ ticketCount }} 趟</small>
          </h2>
          <div class="filters">
            <el-input-tag
              v-model="trainFilters"
              class="train-filter-input"
              placeholder="输入车次后回车，如 G1"
              clearable
              aria-label="筛选车次"
            />
            <el-select v-model="seatFilter" popper-class="monitor-seat-options" aria-label="关注席别">
              <el-option label="全部席别" value="" />
              <el-option
                v-for="[key, label] in columns"
                :key="key"
                :label="label"
                :value="key"
              />
            </el-select>
            <div class="train-type-switches" aria-label="车种筛选">
              <span>高速动车</span>
              <el-switch
                v-model="highSpeedOnly"
                aria-label="仅显示高速动车"
                @change="selectTrainType('highSpeed', $event)"
              />
              <span>普速列车</span>
              <el-switch
                v-model="ordinaryOnly"
                aria-label="仅显示普速列车"
                @change="selectTrainType('ordinary', $event)"
              />
            </div>
            <el-checkbox v-model="onlyAvailable">仅看有票</el-checkbox>
          </div>
        </div>

        <div v-if="filtered.length" class="ticket-grid" :aria-busy="loading">
          <LeftTicketCard
            v-for="row in filtered"
            :key="row.id"
            :train="row"
            :columns="columns"
          />
        </div>
        <el-empty
          v-else
          :description="loading ? '正在查询…' : !queriedAt ? '请选择车站和日期，开始查询' : rows.length ? '没有符合筛选条件的车次' : '该日期区间暂无车次'"
        />
        <p class="hint">
          <span class="seat-plenty">绿色：大于 20 张</span> ·
          <span class="seat-limited">橙色：1–20 张</span> ·
          <span class="seat-empty">红色：0 张</span>。有座明细的截断值 21 显示为“&gt;20张”；无座保留实际数量。
        </p>
      </section>

      <section class="events">
        <h2>
          有票提醒
          <small>最近 30 条</small>
        </h2>
        <p class="hint">
          监控首次发现有票或余票数量变化时，会发送浏览器通知并在页面内提醒；只关注所选车站、时间、车次、车种与席别。
        </p>
        <p v-if="!events.length" class="hint">暂无提醒</p>
        <ul v-else>
          <li v-for="(event, index) in events" :key="index">
            <time>{{ time(event.at) }}</time>
            {{ event.text }}
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
@font-face {
  font-family: 'Debug2Consolas';
  src: url('/consola.ttf') format('truetype');
  font-display: swap;
}

@font-face {
  font-family: 'Debug2Fangzheng';
  src: url('/FZCDXK.TTF') format('truetype');
  font-display: swap;
}

.monitor-page {
  min-height: 100vh;
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

.monitor-content {
  max-width: 1500px;
  margin: 0 auto;
  padding: 4px 24px;
  color: var(--app-text, #223249);
  font-family: 'Debug2Fangzheng', serif;
}

.monitor-content :deep(input),
.monitor-content :deep(button) {
  font-family: inherit;
}

.page-heading,
.result-header,
.actions,
.filters,
.train-type-switches {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.page-heading,
.result-header {
  justify-content: space-between;
  margin-bottom: 20px;
}

.monitor-navigation {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  margin-left: auto;
}

.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.station-route-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 12px;
}

.swap-stations {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding-top: 12px;
  color: var(--app-muted, #68788a);
  font-size: 12px;
}

.swap-stations :deep(.el-button) {
  font-size: 17px;
}

.station-route-fields .el-form-item {
  min-width: 0;
}

.form-grid :deep(.el-autocomplete),
.form-grid :deep(.el-date-editor),
.form-grid :deep(.el-input-number) {
  width: 100%;
}

.ticket-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: start;
  gap: 12px;
}

.results,
.events {
  margin-top: 28px;
}

.station-filters {
  display: grid;
  gap: 10px;
  margin-top: 18px;
  padding: 14px 18px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: var(--app-surface, #fff);
}

.station-filter-row {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  min-height: 32px;
}

.station-filter-row strong {
  padding-top: 5px;
  color: var(--app-text, #172033);
  white-space: nowrap;
}

.station-filter-row :deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 28px;
}

.station-filter-row :deep(.el-checkbox) {
  min-width: 92px;
  margin-right: 0;
}

.time-filter-row {
  display: grid;
  grid-template-columns: auto 105px minmax(280px, 1fr);
  align-items: center;
  gap: 12px;
  padding: 2px 0 18px;
}

.time-filter-row strong {
  color: var(--app-text, #172033);
  white-space: nowrap;
}

.time-range-value {
  color: var(--app-muted, #52749a);
  font-family: 'Debug2Consolas', monospace;
  white-space: nowrap;
}

.time-filter-row :deep(.el-slider) {
  max-width: 720px;
  margin: 0 12px;
}

.all-stations-button {
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--app-muted, #606266);
  font-size: 14px;
  cursor: pointer;
}

.all-stations-button.active {
  background: var(--app-primary-button, #91add5);
  color: #fff;
}

.events {
  padding-top: 24px;
  border-top: 1px solid #e4eaf0;
}

.el-alert {
  margin-top: 18px;
}

.train-filter-input {
  width: 260px;
}

.filters .el-select {
  width: 155px;
}

.train-type-switches {
  gap: 8px;
  color: var(--app-muted, #4d5f72);
  font-size: 14px;
}

.seat-plenty {
  color: var(--app-success, #00b657);
}

.seat-limited {
  color: var(--app-warning, #ca590c);
}

.seat-empty {
  color: var(--app-danger, #ec0808);
}

h1 {
  margin: 12px 0;
  font-size: 28px;
}

.monitor-content h2 {
  margin: 0;
  font-size: 19px;
}

.hint,
.actions span {
  color: var(--app-muted, #68788a);
  font-size: 13px;
  line-height: 1.8;
}

a {
  color: var(--app-link, #2575b8);
}

small {
  color: var(--app-muted, #68788a);
  font-size: 12px;
  font-weight: normal;
}

ul {
  padding-left: 20px;
}

li {
  padding: 7px 0;
  font-size: 14px;
}

time {
  margin-right: 12px;
  color: var(--app-muted, #68788a);
}

@media (max-width: 1150px) {
  .ticket-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 800px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .station-route-fields {
    grid-column: 1 / -1;
  }

  .monitor-content {
    padding: 24px 14px;
  }
}

@media (max-width: 600px) {
  .top-header {
    position: relative;
    height: auto;
    padding: 10px 12px;
    flex-wrap: wrap;
  }

  .ticket-grid {
    gap: 8px;
  }

  .station-filter-row {
    grid-template-columns: auto 1fr;
  }

  .station-filter-row :deep(.el-checkbox-group) {
    grid-column: 1 / -1;
  }

  .time-filter-row {
    grid-template-columns: auto 1fr;
  }

  .time-filter-row :deep(.el-slider) {
    grid-column: 1 / -1;
    width: calc(100% - 24px);
  }
}

@media (max-width: 480px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .station-route-fields {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  }

  h1 {
    font-size: 23px;
  }

  .filters,
  .train-filter-input {
    width: 100%;
  }
}
</style>

<style>
.monitor-seat-options .el-select-dropdown__item {
  padding-right: 20px;
  padding-left: 20px;
  font-family: 'Debug2Fangzheng', serif;
}
</style>
