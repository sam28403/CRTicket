<template>
  <el-button class="user-top-right" :disabled="isGithubPagesBuild" @click="goToHistory()">
    <el-icon><User /></el-icon>历史记录
  </el-button>
  <el-container class="main-layout">
    <el-aside width="350px" class="main-aside">
      <h2 style="margin-bottom: 20px; font-family: 'Roboto', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif">Sam-Lab CR Ticket Maker</h2>
      <el-form
          :model="ticket"
          :rules="rules"
          ref="formRef"
          label-width="100px"
          label-position="left"
      >
        <el-form-item label="票号">
          <el-input v-model="ticket.number" placeholder="例如：E351822734"></el-input>
        </el-form-item>

        <el-form-item label="起点">
          <el-autocomplete
              v-model="ticket.from"
              :fetch-suggestions="querySearch"
              placeholder="输入站名或拼音"
              clearable
              @select="handleSelect('from', $event)"
          />
        </el-form-item>

        <el-form-item label="终点">
          <el-autocomplete
              v-model="ticket.to"
              :fetch-suggestions="querySearch"
              placeholder="输入站名或拼音"
              clearable
              @select="handleSelect('to', $event)"
          />
        </el-form-item>

        <el-form-item label="车次" prop="trainNo">
          <el-input
              v-model="ticket.trainNo"
              placeholder="例如：G25 或 1461"
          />
        </el-form-item>

        <el-form-item label="开车日期">
          <el-date-picker
              v-model="ticket.date"
              type="date"
              placeholder="请选择乘车日期"
              format="YYYY/MM/DD"
              value-format="YYYY年MM月DD日"
          />
        </el-form-item>

        <el-form-item label="开车时间">
          <el-time-picker
              v-model="ticket.time"
              placeholder="选择开车时间"
              format="HH:mm"
              value-format="HH:mm"
          />
        </el-form-item>

        <el-form-item label="票价">
          <el-input-number v-model="ticket.price" placeholder="请输入数字" :min="0" :step="0.5"></el-input-number>
        </el-form-item>

        <el-form-item label="使用积分">
          <el-switch
              v-model="credit"
              inline-prompt
              :active-icon="Check"
              :inactive-icon="Close"
          />
        </el-form-item>

        <el-form-item label="席位名称">
          <el-select
              v-model="ticket.seatType"
              placeholder="Select"
          >
            <el-option
                v-for="item in options"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="空调选择">
          <el-switch
              v-model="value3"
              :disabled="airSwitchDisabled"
              inline-prompt
              :active-icon="Check"
              :inactive-icon="Close"
          />
        </el-form-item>

        <el-form-item label="座位号">
          <el-input v-model="ticket.seatNo" placeholder="03车12A号"></el-input>
        </el-form-item>

        <el-form-item label="售票地点">
          <el-input v-model="ticket.sellPlace" placeholder="XX站"></el-input>
        </el-form-item>

        <el-form-item label="检票/候车位置">
          <el-input v-model="ticket.gate" placeholder="检票：1A / 候车：一候"></el-input>
        </el-form-item>

        <el-form-item label="提示语">
          <el-input
              v-model="ticket.message"
              :rows="3"
              type="textarea"
              placeholder="输入提示语"
          />
        </el-form-item>

        <el-form-item label="选择背景">
          <el-select
              v-model="ticket.theme"
              placeholder="请选择主题"
              style="width: 240px"
          >
            <el-option
                v-for="item in themeOptions"
                :key="item.id"
                :label="item.label"
                :value="item.id"
                :disabled="item.disabled"
            />
          </el-select>
        </el-form-item>

      </el-form>
      <h3 style="font-family: Consolas, 'Courier New', monospace">Version 260804</h3>
      <h3 style="font-family: Consolas, 'Courier New', monospace">Station Version 10114</h3>

      <el-button type="primary" @click="note">更新内容</el-button>

    </el-aside>

    <el-main class="main-center">
      <el-card class="ticket-preview" shadow="always">
        <div class="ticket-preview-shell" :style="{ height: `${ticketScaledHeight}px` }">
          <div v-if="isMobilePreview" class="ticket-photo-shell">
            <img v-if="mobileTicketImageUrl" class="ticket-photo" :src="mobileTicketImageUrl" alt="Ticket Preview" />
            <div v-else class="ticket-photo-loading">正在渲染预览…</div>
          </div>
          <div class="ticket-preview-scale" :style="{ transform: `scale(${ticketScale})` }">
            <div ref="ticketRef" class="ticket-container" :class="{ 'ticket-dom-source': isMobilePreview }">
            <div class="ticket-bg" :style="{ backgroundImage: `url(./${ticket.theme})` }">
              <div class="ticket-number">{{ticket.number}}</div>
            </div>

            <div class="station-block">
              <div class="station-left">
                <div class="station-name">{{ formatStationName(ticket.from) }}<span class="small">站</span></div>
                <div class="station-en">{{ getStationEnglish(ticket.from) }}</div>
              </div>

              <div class="station-middle">
                <div class="train-no">{{ ticket.trainNo }}</div>
                <div class="arrow">
                  <span class="line"></span>
                  <span class="head"></span>
                </div>
              </div>

              <div class="station-right">
                <div class="station-name">{{ formatStationName(ticket.to) }}<span class="small">站</span></div>
                <div class="station-en">{{ getStationEnglish(ticket.to) }}</div>
              </div>
            </div>

            <div class="ticket-gate">{{ticket.gate}}</div>

            <div class="date-time">{{ticket.date}}&nbsp;&nbsp; {{ticket.time}}开</div>

            <div class="price">￥{{ticket.price}}元</div>

            <div class="tip"><strong>限乘当日当次车</strong></div>

            <div class="seat">{{ticket.seatNo}}</div>

            <div class="seat-class">{{finalSeatType}}</div>

            <div class="ticket-message">
              <p>{{ ticket.message }}</p>
            </div>

            <div class="ticket-type">{{ specialTicketType }}</div>
            <div class="credit">{{ useCredit}}</div>

            <div class="ticket-qrcode" v-if="qrCodeUrl">
              <img :src="qrCodeUrl" alt="QR Code" />
            </div>

            <div class="sell-place">{{ticket.sellPlace}}售</div>
          </div>

          </div>
        </div>
        <div class="download-buttons">
          <el-button type="primary" @click="downloadPDF">
            <el-icon><Document /></el-icon>
            下载 PDF
          </el-button>

          <el-button type="success" @click="downloadPNG">
            <el-icon><Picture /></el-icon>
            下载 PNG
          </el-button>
          <el-button type="success" :disabled="isGithubPagesBuild" @click="openSaveDialog">
            <el-icon><Checked /></el-icon>
            存储到账户
          </el-button>
          <el-dialog
              v-model="saveDistance"
              title="运转里程"
              width="500"
              :before-close="handleClose"
          >
            <span>请输入本次运转的里程数，单位为km。</span>
            <el-input-number v-model="distance" :min="0">
              <template #suffix>
                <span>km</span>
              </template>
            </el-input-number>
            <template #footer>
              <div class="dialog-footer">
                <el-button  @click="saveWithoutDistance">我不知道里程</el-button>
                <el-button type="primary" @click="saveTicket">
                  存储车票
                </el-button>
              </div>
            </template>
          </el-dialog>
        </div>
      </el-card>

    </el-main>
  </el-container>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import QRCode from 'qrcode'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { Check, Checked, Close, Document, Picture, User } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import api from '@/api.js'
import { useUserStore } from '@/stores/user.js'
import { isGithubPagesBuild } from '@/config/deploy.js'
import { renderTicketToCanvas } from '@/utils/ticketExport.js'
import {
  buildTicketPayload,
  createDefaultTicket,
  hasRequiredTicketFields,
  seatOptions,
  themeOptions,
  ticketRules,
} from '@/utils/ticketShared.js'
import {
  formatStationName as formatTicketStationName,
  getStationEnglish as getTicketStationEnglish,
  handleStationSelect,
  queryStationSearch,
  useSeatType,
} from '@/composables/useTicketShared.js'

const userStore = useUserStore()
userStore.init()

const ticket = reactive(createDefaultTicket())
const formRef = ref(null)
const rules = ticketRules
const options = seatOptions

const {
  value3,
  credit,
  airSwitchDisabled,
  finalSeatType,
  specialTicketType,
  useCreditLabel,
} = useSeatType(ticket)

const useCredit = computed(() => useCreditLabel.value)
const querySearch = queryStationSearch
const handleSelect = (field, item) => handleStationSelect(ticket, field, item)
const formatStationName = (name) => formatTicketStationName(name)
const getStationEnglish = (name) => getTicketStationEnglish(name)

const distance = ref(0)
const saveWithoutDistance = () => {
  distance.value = 0
  saveTicket()
}

const qrCodeUrl = ref('')

function generateQRCode(text) {
  if (!text) {
    qrCodeUrl.value = ''
    return
  }
  QRCode.toDataURL(text, { width: 300, margin: 1, color: { dark: '#000000', light: '#0000' } }, (err, url) => {
    if (!err) {
      qrCodeUrl.value = url
    }
  })
}

watch(() => ticket.number, (newVal) => {
  generateQRCode(newVal)
})

const note = () => {
  ElNotification({
    title: '更新车站列表至10114',
    message: '更新车站列表（广东城际），新增车票背景，登录与注册页面输入框改为Element+风格，修复安全漏洞。',
    type: 'info',
    position: 'bottom-right'
  })
}

const ticketRef = ref(null)

const TICKET_BASE_WIDTH = 430
const TICKET_BASE_HEIGHT = Math.round(TICKET_BASE_WIDTH * 54 / 86)
const ticketScale = ref(1)
const ticketScaledHeight = computed(() => Math.round(TICKET_BASE_HEIGHT * ticketScale.value))

function updateTicketScale() {
  const viewportWidth = window.innerWidth || TICKET_BASE_WIDTH
  const availableWidth = viewportWidth - 24
  const nextScale = Math.min(1, availableWidth / TICKET_BASE_WIDTH)
  ticketScale.value = Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1
}

const isMobilePreview = ref(false)
const mobileTicketImageUrl = ref('')

function updateMobilePreviewFlag() {
  const viewportWidth = window.innerWidth || 1024
  isMobilePreview.value = viewportWidth <= 768
}

let mobilePreviewTimer = null
let isRenderingMobilePreview = false
let mobilePreviewRerenderRequested = false

async function renderMobilePreviewNow() {
  if (!isMobilePreview.value) return
  if (!ticketRef.value) return

  if (isRenderingMobilePreview) {
    mobilePreviewRerenderRequested = true
    return
  }

  isRenderingMobilePreview = true
  mobilePreviewRerenderRequested = false

  try {
    const canvas = await renderTicketToCanvas(html2canvas, ticketRef.value)
    mobileTicketImageUrl.value = canvas.toDataURL('image/png')
  } finally {
    isRenderingMobilePreview = false
    if (mobilePreviewRerenderRequested) {
      await renderMobilePreviewNow()
    }
  }
}

function scheduleMobilePreviewRender() {
  if (!isMobilePreview.value) return

  if (mobilePreviewTimer) {
    clearTimeout(mobilePreviewTimer)
  }

  mobilePreviewTimer = setTimeout(() => {
    mobilePreviewTimer = null
    renderMobilePreviewNow()
  }, 120)
}

onMounted(() => {
  generateQRCode(ticket.number)
  updateTicketScale()
  updateMobilePreviewFlag()
  scheduleMobilePreviewRender()
  window.addEventListener('resize', updateTicketScale, { passive: true })
  window.addEventListener('resize', updateMobilePreviewFlag, { passive: true })
  window.addEventListener('resize', scheduleMobilePreviewRender, { passive: true })
  if (!sessionStorage.getItem('notified')) {
    note()
    sessionStorage.setItem('notified', '1')
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTicketScale)
  window.removeEventListener('resize', updateMobilePreviewFlag)
  window.removeEventListener('resize', scheduleMobilePreviewRender)
  if (mobilePreviewTimer) {
    clearTimeout(mobilePreviewTimer)
    mobilePreviewTimer = null
  }
})

watch(ticket, () => {
  scheduleMobilePreviewRender()
}, { deep: true })

watch(qrCodeUrl, () => {
  scheduleMobilePreviewRender()
})

const downloadPDF = async () => {
  if (!hasRequiredTicketFields(ticket)) {
    ElMessage.warning('请填写所有必填项')
    return
  }

  const element = ticketRef.value
  const canvas = await renderTicketToCanvas(html2canvas, element)
  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'cm',
    format: [8.6, 5.4]
  })

  pdf.addImage(imgData, 'PNG', 0, 0, 8.6, 5.4)
  pdf.save(`${ticket.number}.pdf`)
}

const downloadPNG = async () => {
  if (!hasRequiredTicketFields(ticket)) {
    ElMessage.warning('请填写所有必填项')
    return
  }

  const element = ticketRef.value
  const canvas = await renderTicketToCanvas(html2canvas, element)
  const imgData = canvas.toDataURL('image/png')

  const link = document.createElement('a')
  link.href = imgData
  link.download = `${ticket.number}.png`
  link.click()
}

const router = useRouter()
const goToHistory = () => {
  if (isGithubPagesBuild) return
  router.push('/history')
}

const saveDistance = ref(false)
const openSaveDialog = () => {
  if (isGithubPagesBuild) {
    ElMessage.warning('GitHub Pages 演示版不支持账号存储/历史记录功能')
    return
  }
  if (!userStore.isLogin) {
    ElMessage.warning('请先登录')
    return
  }
  saveDistance.value = true
}

const handleClose = (done) => {
  ElMessageBox.confirm('你确定不要存储这张车票？')
    .then(() => {
      done()
    })
    .catch(() => {
      // catch error
    })
}

const getCurrentUser = () => {
  if (!userStore.isLogin) return null
  return JSON.parse(localStorage.getItem('user'))
}

const saveTicket = async () => {
  if (!hasRequiredTicketFields(ticket)) {
    ElMessage.warning('请填写完整车票信息')
    return
  }

  const currentUser = getCurrentUser()
  if (!currentUser) {
    ElMessage.warning('请先登录')
    return
  }

  try {
    const res = await api.post(
      'http://localhost:3000/api/ticket/add',
      buildTicketPayload(ticket, {
        userId: currentUser.id,
        useCredit: credit.value,
        finalSeatType: finalSeatType.value,
        hasConditioner: value3.value,
        distance: distance.value,
      })
    )

    if (res.data.success) {
      ElMessage.success('车票保存成功')
      saveDistance.value = false
    } else {
      ElMessage.error(res.data.message)
    }
  } catch (err) {
    ElMessage.error('保存失败')
  }
}
</script>

<style scoped>
@import "../assets/styles/App.css";

.main-layout {
  height: 100vh;
}

.main-aside {
  background: #f8f9fa;
  padding: 20px;
}

.ticket-preview-shell {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.ticket-preview-scale {
  transform-origin: top center;
}

.ticket-dom-source {
  position: fixed;
  left: -10000px;
  top: 0;
  pointer-events: none;
}

.ticket-photo-shell {
  width: 100%;
  display: flex;
  justify-content: center;
}

.ticket-photo {
  width: min(100%, 430px);
  height: auto;
  display: block;
}

.ticket-photo-loading {
  width: min(100%, 430px);
  text-align: center;
  padding: 24px 0;
  color: rgba(0, 0, 0, 0.55);
}

@media (max-width: 768px) {
  .main-layout {
    height: auto;
    min-height: 100vh;
    flex-direction: column;
  }

  .main-aside {
    width: 100% !important;
    padding: 14px 12px;
  }

  .main-center {
    padding: 16px 12px;
  }

  :deep(.el-dialog) {
    width: 92vw !important;
    max-width: 520px;
  }
}
</style>
