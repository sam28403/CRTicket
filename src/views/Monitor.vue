<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api.js'
import LeftTicketCard from '@/components/LeftTicketCard.vue'
import { stations, queryStationSearch } from '@/composables/useTicketShared.js'

const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const from = ref('')
const to = ref('')
const date = ref(today())
const interval = ref(60)
const trainFilter = ref('')
const seatFilter = ref('')
const onlyAvailable = ref(false)
const monitoring = ref(false)
const loading = ref(false)
const rows = ref([])
const queriedAt = ref('')
const error = ref('')
const nextAt = ref('')
const events = ref([])
const columns = [ ['second', '二等座'], ['first', '一等座'], ['premiumSleeper', '优选一等座'],
  ['business', '商务座'], ['premium', '特等座'], ['advancedSleeper', '高级软卧'], ['softSleeper', '软卧 / 动卧'],
  ['hardSleeper', '硬卧'], ['softSeat', '软座'], ['hardSeat', '硬座'], ['standing', '无座'], ['other', '其他'] ]
let timer
let controller
let generation = 0
let previous = new Map()
const available = value => value === '有' || value === '>20' || /^\d+$/.test(value) && Number(value) > 0
const matches = row => !trainFilter.value.trim() || trainFilter.value.toUpperCase().split(/[\s,，]+/).filter(Boolean).includes(row.train.toUpperCase())
const hasTicket = row => row.canBuy && (seatFilter.value ? available(row.seats[seatFilter.value]) : Object.values(row.seats).some(available))
const filtered = computed(() => rows.value.filter(row => matches(row) && (!onlyAvailable.value || hasTicket(row))))
const ticketCount = computed(() => rows.value.filter(row => matches(row) && hasTicket(row)).length)
const time = value => value ? new Date(value).toLocaleTimeString('zh-CN', { hour12: false }) : '—'
const disabledDate = value => {
  const key = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  const end = new Date(Date.now() + 8 * 3600000 + 14 * 86400000).toISOString().slice(0, 10)
  return key < today() || key > end
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
  previous = new Map()
}
watch([from, to, date], reset, { flush: 'sync' })
watch([trainFilter, seatFilter], () => { previous = new Map(); events.value = [] })
function parameters() {
  const start = stations.find(station => station.name === from.value.trim())
  const end = stations.find(station => station.name === to.value.trim())
  if (!start || !end) throw new Error('请输入并选择有效的出发站和到达站')
  if (start.telecode === end.telecode) throw new Error('出发站和到达站不能相同')
  if (!date.value) throw new Error('请选择出发日期')
  return { from: start.telecode, to: end.telecode, date: date.value }
}
async function query(startMonitor = false) {
  if (loading.value) return
  let params
  try { params = parameters() } catch (e) { error.value = e.message; return }
  clearTimeout(timer)
  if (startMonitor) {
    monitoring.value = true
    previous = new Map()
  }
  const current = ++generation
  controller = new AbortController()
  loading.value = true
  error.value = ''
  nextAt.value = ''
  try {
    const { data } = await api.get('/left-ticket', { params, timeout: 25000, signal: controller.signal })
    if (current !== generation) return
    if (!data.success || !Array.isArray(data.trains)) throw new Error('后端返回的数据格式错误')
    rows.value = data.trains
    queriedAt.value = data.queriedAt
    const currentTickets = new Map()
    const notices = []
    for (const row of rows.value.filter(matches)) {
      const signature = JSON.stringify(seatFilter.value ? row.seats[seatFilter.value] : row.seats)
      if (hasTicket(row)) {
        currentTickets.set(row.id, signature)
        if (monitoring.value && previous.get(row.id) !== signature) {
          const detail = columns.filter(([key]) => (!seatFilter.value || key === seatFilter.value) && available(row.seats[key]))
            .map(([key, label]) => `${label}：${row.seats[key]}`).join('，')
          events.value.unshift({ at: data.queriedAt, text: `${row.train} ${row.from} → ${row.to}，${detail}` })
          notices.push(row.train)
        }
      }
    }
    events.value = events.value.slice(0, 30)
    if (notices.length) ElMessage.success(`${notices.slice(0, 3).join('、')}${notices.length > 3 ? ` 等 ${notices.length} 趟车` : ''} 有票或余票发生变化，详见有票提醒`)
    previous = currentTickets
  } catch (e) {
    if (current !== generation) return
    error.value = e.response?.data?.message || (e.code === 'ECONNABORTED' ? '查询超时，请检查后端连接' : e.message || '查询失败')
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
  <main class="debug2">
    <header><div><h1>余票查询与监控 <el-tag type="warning">Beta</el-tag></h1>
      <p>输入车站，查看余票变化。</p></div>
      <nav class="monitor-navigation" aria-label="页面导航">
        <RouterLink to="/">生成车票</RouterLink>
        <a href="https://www.12306.cn" target="_blank" rel="noopener noreferrer">打开 12306 官网 ↗</a>
      </nav></header>
    <el-card shadow="never">
      <el-form label-position="top" @submit.prevent="query()">
        <div class="form-grid">
          <el-form-item label="出发站"><el-autocomplete v-model="from" :fetch-suggestions="queryStationSearch" placeholder="站名 / 拼音 / 首字母" clearable /></el-form-item>
          <el-form-item label="到达站"><el-autocomplete v-model="to" :fetch-suggestions="queryStationSearch" placeholder="站名 / 拼音 / 首字母" clearable /></el-form-item>
          <el-form-item label="出发日期"><el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" :disabled-date="disabledDate" :editable="false" /></el-form-item>
          <el-form-item label="监控间隔（秒）"><el-input-number v-model="interval" :min="10" :max="3600" :step="10" :disabled="monitoring" /></el-form-item>
        </div>
        <div class="actions">
          <el-button type="primary" :loading="loading" :disabled="monitoring" @click="query()">查询余票</el-button>
          <el-button type="success" :disabled="loading || monitoring" @click="query(true)">开始监控</el-button>
          <el-button :disabled="!monitoring && !loading" @click="stop">停止</el-button>
          <span role="status">{{ monitoring ? '监控中' : '未监控' }} · 上次成功：{{ time(queriedAt) }}<template v-if="nextAt"> · 下次查询：{{ time(nextAt) }}</template></span>
        </div>
      </el-form>
      <p class="hint">成人票 · 今天起 15 天内 · 最短间隔 10 秒。监控仅在此页面打开时运行，电脑休眠或后台标签页可能延迟；失败后自动停止。余票以官网实时结果为准。</p>
    </el-card>
    <el-alert v-if="error" :title="error" :description="queriedAt ? '下方保留的是上次成功结果，可能已过期；监控已停止，请手动重试。' : '请检查查询条件、后端服务或官网状态后重试。'" type="error" show-icon :closable="false" role="alert" />
    <section class="results">
      <div class="result-header"><h2>查询结果 <small>{{ filtered.length }} 趟 · 关注席别有票 {{ ticketCount }} 趟</small></h2>
        <div class="filters"><el-input v-model="trainFilter" placeholder="车次，如 G1,G3（精确匹配）" clearable aria-label="筛选车次" />
          <el-select popper-class="debug2-seat-options" v-model="seatFilter" aria-label="关注席别"><el-option label="全部席别" value="" /><el-option v-for="[key, label] in columns" :key="key" :label="label" :value="key" /></el-select>
          <el-checkbox v-model="onlyAvailable">仅看有票</el-checkbox></div>
      </div>
      <div v-if="filtered.length" class="ticket-grid" :aria-busy="loading">
        <LeftTicketCard v-for="row in filtered" :key="row.id" :train="row" :columns="columns" />
      </div>
      <el-empty v-else :description="loading ? '正在查询…' : !queriedAt ? '请选择车站和日期，开始查询' : rows.length ? '没有符合筛选条件的车次' : '该日期区间暂无车次'" />
      <p class="hint"><span class="seat-plenty">绿色：大于 20 张</span> · <span class="seat-limited">橙色：1–20 张</span> · <span class="seat-empty">红色：0 张</span>。有座明细的截断值 21 显示为“>20张”；无座保留实际数量。</p>
    </section>
    <section class="events"><h2>有票提醒 <small>最近 30 条</small></h2><p class="hint">监控首次发现有票或余票数量变化时在页面内提醒；只关注所选车次与席别。</p>
      <p v-if="!events.length" class="hint">暂无提醒</p><ul v-else><li v-for="(event, index) in events" :key="index"><time>{{ time(event.at) }}</time> {{ event.text }}</li></ul>
    </section>
  </main>
</template>

<style scoped>
@font-face { font-family: 'Debug2Consolas'; src: url('/consola.ttf') format('truetype'); font-display: swap; }
@font-face { font-family: 'Debug2Fangzheng'; src: url('/FZCDXK.TTF') format('truetype'); font-display: swap; }
.debug2 { max-width: 1500px; margin: 0 auto; padding: 36px 24px; color: #223249; font-family: 'Debug2Fangzheng', serif; }
.debug2 :deep(input), .debug2 :deep(button) { font-family: inherit; }
.ticket-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: start; }
@media (max-width: 1150px) { .ticket-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .ticket-grid { gap: 8px; } }
header, .result-header, .actions, .filters { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
header, .result-header { justify-content: space-between; margin-bottom: 20px; }
.monitor-navigation { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; margin-left: auto; }
.seat-plenty { color: #00b657; } .seat-limited { color: #ca590c; } .seat-empty { color: #ec0808; }
.eyebrow { font-size: 12px; letter-spacing: 2px; color: #57758a; }
h1 { font-size: 28px; margin: 12px 0; } h2 { font-size: 19px; margin: 0; }
header p, .hint, .actions span { color: #68788a; font-size: 13px; line-height: 1.8; }
a { color: #2575b8; } small { font-size: 12px; font-weight: normal; color: #68788a; }
.form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
.form-grid :deep(.el-autocomplete), .form-grid :deep(.el-date-editor), .form-grid :deep(.el-input-number) { width: 100%; }
.results, .events { margin-top: 28px; } .el-alert { margin-top: 18px; }
.filters .el-input { width: 260px; } .filters .el-select { width: 155px; }
.available { color: #16804b; font-weight: 700; }
.events { border-top: 1px solid #e4eaf0; padding-top: 24px; } ul { padding-left: 20px; } li { padding: 7px 0; font-size: 14px; } time { color: #68788a; margin-right: 12px; }
@media (max-width: 800px) { .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .debug2 { padding: 24px 14px; } }
@media (max-width: 480px) { .form-grid { grid-template-columns: 1fr; gap: 0; } h1 { font-size: 23px; } .filters { width: 100%; } .filters .el-input { width: 100%; } }
</style>

<style>
.debug2-seat-options .el-select-dropdown__item { padding-left: 20px; padding-right: 20px; font-family: 'Debug2Fangzheng', serif; }
</style>
