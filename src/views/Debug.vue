<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api.js'
import { useUserStore } from '@/stores/user.js'
import {
  buildTicketPayload,
  DEFAULT_TICKET_MESSAGE,
  DEFAULT_TICKET_THEME,
  disableAirSeats,
  seatOptions,
} from '@/utils/ticketShared.js'
import stationNames from '@/station_name.js'

const userStore = useUserStore()
userStore.init()

const generationCount = ref(1)
const isGenerating = ref(false)
const generatedTickets = ref([])

const stationPool = buildStationPool(stationNames)
const seatPool = seatOptions.slice()

const currentUser = computed(() => {
  if (!userStore.isLogin) return null

  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
})

const userLabel = computed(() => currentUser.value?.username || '')

function buildStationPool(rawStations) {
  const map = new Map()

  rawStations
    .split('@')
    .filter(Boolean)
    .forEach((item) => {
      const parts = item.split('|')
      const name = parts[1]
      if (!name || map.has(name)) return

      map.set(name, {
        name,
        en: parts[3] || '',
        city: parts[7] || '',
      })
    })

  return Array.from(map.values())
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice(list) {
  return list[randomInt(0, list.length - 1)]
}

function buildTicketNumber() {
  const letter = String.fromCharCode(65 + randomInt(0, 25))
  const digits = String(randomInt(0, 999999999)).padStart(9, '0')
  return `${letter}${digits}`
}

function buildTrainNo() {
  const modes = ['digit4', 'digit5', 'letter']
  const mode = randomChoice(modes)

  if (mode === 'digit4') {
    return String(randomInt(1000, 9999))
  }

  if (mode === 'digit5') {
    return String(randomInt(50000, 59999))
  }

  const prefix = randomChoice(['G', 'C', 'D', 'Z', 'T', 'K', 'L', 'Y', 'S'])
  return `${prefix}${randomInt(1, 9999)}`
}

function buildCurrentMonthDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  const day = randomInt(1, lastDay)

  return `${year}年${String(month + 1).padStart(2, '0')}月${String(day).padStart(2, '0')}日`
}

function buildRandomTime() {
  const hour = String(randomInt(0, 23)).padStart(2, '0')
  const minute = String(randomInt(0, 59)).padStart(2, '0')
  return `${hour}:${minute}`
}

function buildRandomPrice() {
  return Math.floor(Math.random() * 8001) / 2
}

function buildRandomDistance() {
  return randomInt(5, 5000)
}

function buildRandomStations() {
  if (stationPool.length < 2) {
    return { from: '', to: '' }
  }

  const fromIndex = randomInt(0, stationPool.length - 1)
  let toIndex = randomInt(0, stationPool.length - 1)

  while (toIndex === fromIndex) {
    toIndex = randomInt(0, stationPool.length - 1)
  }

  return {
    from: stationPool[fromIndex].name,
    to: stationPool[toIndex].name,
  }
}

function buildSeatNumber() {
  const carNo = String(randomInt(1, 19)).padStart(2, '0')
  const seatNo = String(randomInt(1, 118)).padStart(3, '0')
  return `${carNo}车${seatNo}号`
}

function buildSeatConfig() {
  const seat = randomChoice(seatPool).value
  const hasConditioner = disableAirSeats.includes(seat) ? 0 : randomInt(0, 1)

  return {
    seatType: seat,
    hasConditioner,
    finalSeatType: hasConditioner ? `新空调${seat}` : seat,
  }
}

function buildRandomTicket() {
  const { from, to } = buildRandomStations()
  const { seatType, hasConditioner, finalSeatType } = buildSeatConfig()

  return {
    number: buildTicketNumber(),
    trainNo: buildTrainNo(),
    from,
    to,
    date: buildCurrentMonthDate(),
    time: buildRandomTime(),
    price: buildRandomPrice(),
    seatType,
    hasConditioner,
    finalSeatType,
    seatNo: buildSeatNumber(),
    sellPlace: '网',
    gate: '',
    message: DEFAULT_TICKET_MESSAGE,
    theme: DEFAULT_TICKET_THEME,
    useCredit: randomInt(0, 1),
    distance: buildRandomDistance(),
  }
}

async function handleGenerate() {
  const count = Math.trunc(Number(generationCount.value) || 0)

  if (count < 1) {
    ElMessage.warning('请输入大于 0 的数量')
    return
  }

  const user = currentUser.value
  if (!user?.id) {
    ElMessage.warning('请先登录后再生成车票')
    return
  }

  isGenerating.value = true
  generatedTickets.value = []

  let successCount = 0
  let failCount = 0

  for (let index = 0; index < count; index += 1) {
    const ticket = buildRandomTicket()

    try {
      const payload = buildTicketPayload(ticket, {
        userId: user.id,
        useCredit: ticket.useCredit === 1,
        finalSeatType: ticket.finalSeatType,
        hasConditioner: ticket.hasConditioner === 1,
        distance: ticket.distance,
      })

      const res = await api.post('/ticket/add', payload)
      const ok = Boolean(res?.data?.success)

      if (ok) {
        successCount += 1
      } else {
        failCount += 1
      }

      generatedTickets.value.push({
        index: index + 1,
        ...ticket,
        saveStatus: ok ? '成功' : '失败',
        saveMessage: res?.data?.message || (ok ? '保存成功' : '保存失败'),
      })
    } catch (error) {
      failCount += 1
      generatedTickets.value.push({
        index: index + 1,
        ...ticket,
        saveStatus: '失败',
        saveMessage: error?.message || '保存失败',
      })
    }
  }

  isGenerating.value = false

  if (successCount > 0) {
    ElMessage.success(`已生成 ${successCount} 张车票${failCount > 0 ? `，失败 ${failCount} 张` : ''}`)
  } else {
    ElMessage.error(`生成失败 ${failCount} 张，请检查登录状态或后端服务`)
  }
}
</script>

<template>
  <div class="debug-page">
    <header class="debug-hero">
      <div>
        <p class="eyebrow">Debug Workspace</p>
        <h1>随机车票生成器</h1>
        <p class="subtitle">
          输入数量后，系统会按当前登录用户名批量生成并保存随机车票。
        </p>
      </div>

      <div class="user-card">
        <span class="user-label">当前登录用户</span>
        <strong v-if="userLabel">{{ userLabel }}</strong>
        <strong v-else>未登录</strong>
        <span class="user-hint" v-if="!userStore.isLogin">请先登录后再操作</span>
        <span class="user-hint" v-else>车票将保存到该账号下</span>
      </div>
    </header>

    <section class="control-panel">
      <div class="control-row">
        <div class="input-wrap">
          <label for="ticket-count">生成数量</label>
          <el-input-number
            id="ticket-count"
            v-model="generationCount"
            :min="1"
            :max="1000"
            :step="1"
            controls-position="right"
          />
        </div>

        <el-button
          type="primary"
          size="large"
          :loading="isGenerating"
          :disabled="!userStore.isLogin"
          @click="handleGenerate"
        >
          确定生成
        </el-button>
      </div>

      <el-alert
        title="背景和提示语使用默认值；票号、车次、站点、票价、日期、时间、积分、席位、空调、座位号、售票地点都会随机生成。"
        type="info"
        show-icon
        :closable="false"
      />
    </section>

    <section class="result-panel">
      <div class="panel-head">
        <h2>生成结果</h2>
        <span v-if="generatedTickets.length">共 {{ generatedTickets.length }} 条</span>
      </div>

      <el-empty v-if="!generatedTickets.length" description="还没有生成任何车票" />

      <el-table
        v-else
        :data="generatedTickets"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="index" label="#" width="70" />
        <el-table-column prop="number" label="票号" width="170" />
        <el-table-column prop="trainNo" label="车次" width="100" />
        <el-table-column label="起终点" min-width="180">
          <template #default="{ row }">
            {{ row.from }} → {{ row.to }}
          </template>
        </el-table-column>
        <el-table-column prop="date" label="日期" width="140" />
        <el-table-column prop="time" label="时间" width="100" />
        <el-table-column label="票价" width="100">
          <template #default="{ row }">
            ￥{{ row.price }}
          </template>
        </el-table-column>
        <el-table-column label="席位" width="120">
          <template #default="{ row }">
            {{ row.finalSeatType }}
          </template>
        </el-table-column>
        <el-table-column label="空调" width="90">
          <template #default="{ row }">
            {{ row.hasConditioner === 1 ? '1' : '0' }}
          </template>
        </el-table-column>
        <el-table-column prop="seatNo" label="座位号" width="120" />
        <el-table-column label="积分" width="90">
          <template #default="{ row }">
            {{ row.useCredit === 1 ? '1' : '0' }}
          </template>
        </el-table-column>
        <el-table-column prop="distance" label="里程" width="100" />
        <el-table-column prop="saveStatus" label="保存" width="90" />
        <el-table-column prop="saveMessage" label="说明" min-width="140" />
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.debug-page {
  min-height: 100vh;
  padding: 32px;
  background:
    radial-gradient(circle at top left, rgba(79, 140, 255, 0.18), transparent 28%),
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.16), transparent 24%),
    linear-gradient(180deg, #f7f9fc 0%, #eef3f8 100%);
  color: #162033;
}

.debug-hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 700;
  color: #5f6f8f;
}

.debug-hero h1 {
  margin: 0;
  font-size: 36px;
  line-height: 1.1;
}

.subtitle {
  max-width: 720px;
  margin: 12px 0 0;
  font-size: 15px;
  color: #52617d;
}

.user-card {
  min-width: 220px;
  padding: 18px 20px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 14px 35px rgba(22, 32, 51, 0.08);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-label {
  font-size: 12px;
  color: #6d7a92;
}

.user-hint {
  font-size: 13px;
  color: #7f8ba3;
}

.control-panel,
.result-panel {
  padding: 20px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 16px 40px rgba(22, 32, 51, 0.08);
  backdrop-filter: blur(10px);
}

.control-panel {
  margin-bottom: 24px;
}

.control-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.input-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-wrap label {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-head h2 {
  margin: 0;
  font-size: 22px;
}

.panel-head span {
  color: #6b7280;
  font-size: 14px;
}

@media (max-width: 900px) {
  .debug-page {
    padding: 18px;
  }

  .debug-hero {
    flex-direction: column;
  }

  .user-card {
    width: 100%;
  }
}
</style>
