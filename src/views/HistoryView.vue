<template>
  <div class="history-page">
    <el-container class="history-layout">
      <el-header class="top-header">
        <el-avatar src="Picture1.png" />
        <h2>Sam-Lab CR Ticket Maker</h2>
      </el-header>
      <el-container>
        <el-aside width="220px" class="history-sidebar">
          <el-space direction="vertical" fill style="width: 100%">
            <el-button size="large" @click="goHome()">车票生成</el-button>
            <el-button size="large" type="primary">车票历史</el-button>
            <el-button v-if="userStore.isLogin" size="large" @click="goUser()">账户管理</el-button>
            <el-button v-else size="large" @click="goLogin()">账户管理</el-button>
          </el-space>

        </el-aside>
        <el-main>
          <el-dialog v-model="dialogFormVisible1" :title="isEditMode ? '编辑记录' : '补登记录'" width="50%">
            <el-form
                :model="ticket"
                :rules="rules"
                ref="formRef"
                label-width="100px"
                label-position="left"
            >
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="票号">
                    <el-input v-model="ticket.number" placeholder="例如：E351822734"></el-input>
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="车次" prop="trainNo">
                    <el-input v-model="ticket.trainNo" placeholder="例如：G25 或 1461" />
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="起点">
                    <el-autocomplete
                        v-model="ticket.from"
                        :fetch-suggestions="querySearch"
                        placeholder="输入站名或拼音"
                        clearable
                        @select="handleSelect('from', $event)"
                    />
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="终点">
                    <el-autocomplete
                        v-model="ticket.to"
                        :fetch-suggestions="querySearch"
                        placeholder="输入站名或拼音"
                        clearable
                        @select="handleSelect('to', $event)"
                    />
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="开车日期">
                    <el-date-picker
                        v-model="ticket.date"
                        type="date"
                        placeholder="请选择乘车日期"
                        format="YYYY/MM/DD"
                        value-format="YYYY年MM月DD日"
                    />
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="开车时间">
                    <el-time-picker
                        v-model="ticket.time"
                        placeholder="选择开车时间"
                        format="HH:mm"
                        value-format="HH:mm"
                    />
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="票价">
                    <el-input-number v-model="ticket.price" placeholder="请输入数字" :min="0" :step="0.5"></el-input-number>
                  </el-form-item>
                </el-col>

                <el-col :span="6">
                  <el-form-item label="使用积分">
                    <el-switch
                        v-model="credit"
                        inline-prompt
                        :active-icon="Check"
                        :inactive-icon="Close"
                    />
                  </el-form-item>
                </el-col>

                <el-col :span="6">
                  <el-form-item label="空调选择">
                    <el-switch
                        v-model="value3"
                        :disabled="airSwitchDisabled"
                        inline-prompt
                        :active-icon="Check"
                        :inactive-icon="Close"
                    />
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="席位名称">
                    <el-select v-model="ticket.seatType" placeholder="Select">
                      <el-option
                          v-for="item in options"
                          :key="item.value"
                          :label="item.label"
                          :value="item.value"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="座位号">
                    <el-input v-model="ticket.seatNo" placeholder="03车12A号"></el-input>
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="售票地点">
                    <el-input v-model="ticket.sellPlace" placeholder="XX站"></el-input>
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="检票/候车位置">
                    <el-input v-model="ticket.gate" placeholder="检票：1A / 候车：一候"></el-input>
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="选择背景">
                    <el-select v-model="ticket.theme" placeholder="请选择主题" style="width: 240px">
                      <el-option
                          v-for="item in themeOptions"
                          :key="item.id"
                          :label="item.label"
                          :value="item.id"
                          :disabled="item.disabled"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>

                <el-col :span="12">
                  <el-form-item label="里程">
                    <el-input-number v-model="ticket.distance" placeholder="请输入数字" :min="0"></el-input-number>
                  </el-form-item>
                </el-col>

                <!-- 提示语单独占一行 -->
                <el-col :span="24">
                  <el-form-item label="提示语">
                    <el-input
                        v-model="ticket.message"
                        :rows="3"
                        type="textarea"
                        placeholder="输入提示语"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>

            <template #footer>
              <div class="dialog-footer">
                <el-button @click="dialogFormVisible1 = false">Cancel</el-button>
                <el-button type="primary" @click="saveTicket()">
                  Confirm
                </el-button>
              </div>
            </template>
          </el-dialog>
          <div v-if="userStore.isLogin">
            <el-backtop :right="20" :bottom="20" />
            <el-card class="user-card">
              <div class="card-container">
                <el-button type="danger" size="large" class="signout-top-right" @click="logout()">
                  <el-icon><CloseBold /></el-icon>登出账户
                </el-button>
                <el-button type="success" size="large" class="supplement-bottom-right" @click="openCreateDialog()">
                  <el-icon><DocumentAdd /></el-icon>补登记录
                </el-button>

                <el-avatar :size="120" src="Picture1.png" />

                <div class="card-content">
                  <h1>Hi, {{ username }}</h1>
                  <p>
                    你已经运转了
                    <span class="highlight">{{ Math.floor(tripsVal) }}</span> 次，
                    <span class="highlight">{{ Math.floor(distanceVal) }}</span> 公里，
                    共消费
                    <span class="highlight">{{ formatMoney(moneyVal) }}</span> 元！
                  </p>
                </div>
              </div>
            </el-card>

            <div class="table-shell">
              <el-table
                  v-loading="pageLoading"
                  :data="pagedTableData"
                  :default-sort="{ prop: 'date', order: 'descending' }"
                  @sort-change="handleSortChange"
                  class="table"
                  :row-style="tableRowStyle"
              >
                <el-table-column prop="date" label="日期" width="160" sortable/>
                <el-table-column prop="trainNo" label="车次" width="80" />
                <el-table-column prop="price" label="票价" width="80" sortable/>
                <el-table-column prop="from" label="起点" width="120" />
                <el-table-column prop="to" label="终点" width="120" />
                <el-table-column prop="seatType" label="席位" width="120" />
                <el-table-column prop="seatNo" label="座位" width="150" />
                <el-table-column prop="number" label="票号/订单号" width="135" />
                <el-table-column label="操作" width="200">
                  <template #default="scope">
                    <el-tooltip
                        content="下载车票"
                        placement="bottom"
                    >
                      <el-button type="success" @click="downloadHistoryPNG(scope.row)">
                        <el-icon><Download /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <el-tooltip
                        content="编辑记录"
                        placement="bottom"
                    >
                      <el-button @click="openEditDialog(scope.row)">
                        <el-icon><Edit /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <el-tooltip
                        content="删除记录"
                        placement="bottom"
                    >
                      <el-button type="danger" @click="deleteHistory(scope.row)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <el-pagination
                size="large"
                background
                layout="prev, pager, next"
                class="history-pagination"
                :current-page="currentPage"
                :page-size="pageSize"
                :total="tableData.length"
                @current-change="handlePageChange"
            />

            <div class="history-download-render">
              <div ref="historyTicketRef" class="ticket-container">
                <div class="ticket-bg" :style="{ backgroundImage: `url(./${downloadTicket.theme})` }">
                  <div class="ticket-number">{{ downloadTicket.number }}</div>
                </div>

                <div class="station-block">
                  <div class="station-left">
                    <div class="station-name">{{ formatStationName(downloadTicket.from) }}<span class="small">站</span></div>
                    <div class="station-en">{{ getStationEnglish(downloadTicket.from) }}</div>
                  </div>

                  <div class="station-middle">
                    <div class="train-no">{{ downloadTicket.trainNo }}</div>
                    <div class="arrow">
                      <span class="line"></span>
                      <span class="head"></span>
                    </div>
                  </div>

                  <div class="station-right">
                    <div class="station-name">{{ formatStationName(downloadTicket.to) }}<span class="small">站</span></div>
                    <div class="station-en">{{ getStationEnglish(downloadTicket.to) }}</div>
                  </div>
                </div>

                <div class="ticket-gate">{{ downloadTicket.gate }}</div>
                <div class="date-time">{{ downloadTicket.date }}&nbsp;&nbsp; {{ downloadTicket.time }}开</div>
                <div class="price">￥{{ downloadTicket.price }}元</div>
                <div class="tip"><strong>限乘当日当次车</strong></div>
                <div class="seat">{{ downloadTicket.seatNo }}</div>
                <div class="seat-class">{{ downloadTicket.seatType }}</div>

                <div class="ticket-message">
                  <p>{{ downloadTicket.message }}</p>
                </div>

                <div class="ticket-type">{{ downloadTicket.specialTicketType }}</div>
                <div class="credit">{{ downloadTicket.useCredit }}</div>

                <div class="ticket-qrcode" v-if="downloadQrCodeUrl">
                  <img :src="downloadQrCodeUrl" alt="QR Code" />
                </div>

                <div class="sell-place">{{ downloadTicket.sellPlace }}售</div>
              </div>
            </div>
          </div>
          <div v-else>
            <el-empty :image-size="200" description="请先登录！">
              <el-button type="primary" size="large" @click="goLogin">
                <el-icon><User /></el-icon>登录
              </el-button>
            </el-empty>
          </div>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>


<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useTransition } from '@vueuse/core'
import { Check, Close, CloseBold, Delete, DocumentAdd, Download, Edit, User } from '@element-plus/icons-vue'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user.js'
import api from '@/api.js'
import {
  buildTicketPayload,
  createDefaultTicket,
  DEFAULT_TICKET_MESSAGE,
  DEFAULT_TICKET_THEME,
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

const router = useRouter()
const goHome = () => {
  router.push('/')
}

const goLogin = () => {
  router.push('/login')
}

const goUser = () => {
  router.push('/user')
}

const userStore = useUserStore()

const getCurrentUser = () => {
  return JSON.parse(localStorage.getItem('user'))
}

userStore.init()

const loginValue = computed({
  get: () => userStore.isLogin,
  set: (val) => userStore.setLogin(val)
})

const logout = () => {
  loginValue.value = false
  ElMessage({
    message: '登出账户成功',
    type: 'success',
  })
}

const trips = ref(0)
const distance = ref(0)
const money = ref(0)

const dialogFormVisible1 = ref(false)
const editingTicketId = ref(null)
const isEditMode = computed(() => editingTicketId.value !== null)
const ticket = reactive(createDefaultTicket())
const formRef = ref(null)
const rules = ticketRules
const options = seatOptions

const {
  value3,
  credit,
  airSwitchDisabled,
  finalSeatType,
} = useSeatType(ticket)

const querySearch = queryStationSearch
const handleSelect = (field, item) => handleStationSelect(ticket, field, item)
const formatStationName = (name) => formatTicketStationName(name, true)
const getStationEnglish = (name) => getTicketStationEnglish(name, true)

const tripsVal = useTransition(trips, { duration: 1500 })
const distanceVal = useTransition(distance, { duration: 1500 })
const moneyVal = useTransition(money, { duration: 1500 })
const formatMoney = (val) => {
  const num = Number(val)
  return num % 1 === 0 ? num.toString() : num.toFixed(1)
}

const tickets = ref([])
const historyTicketRef = ref(null)
const downloadQrCodeUrl = ref('')
const downloadTicket = reactive({
  ...createDefaultTicket(),
  theme: DEFAULT_TICKET_THEME,
  message: DEFAULT_TICKET_MESSAGE,
  specialTicketType: '',
  useCredit: '',
})

const tableData = computed(() =>
  tickets.value.map((ticket) => ({
    id: ticket.id,
    date: ticket.travel_date || ticket.date || '',
    trainNo: ticket.train_no || ticket.trainNo || '',
    time: ticket.departure_time || ticket.time || '',
    price: ticket.price ?? 0,
    from: ticket.departure_station || ticket.from || '',
    to: ticket.arrival_station || ticket.to || '',
    seatType: ticket.seat_type || ticket.seatType || '',
    hasConditioner: ticket.has_conditioner ?? ticket.hasConditioner ?? 0,
    seatNo: ticket.seat_no || ticket.seatNo || '',
    gate: ticket.gate_info || ticket.gate || '',
    number: ticket.ticket_number || ticket.number || '',
    sellPlace: ticket.sell_place || ticket.sellPlace || '',
    message: ticket.message || DEFAULT_TICKET_MESSAGE,
    theme: ticket.theme || DEFAULT_TICKET_THEME,
    useCredit: ticket.use_credit || 0,
    distance: ticket.distance ?? 0,
  }))
)

const pageSize = 10
const currentPage = ref(1)
const pageLoading = ref(false)
const sortState = ref({
  prop: 'date',
  order: 'descending',
})
const sortedTableData = computed(() => {
  const { prop, order } = sortState.value
  if (!prop || !order) {
    return tableData.value
  }

  const direction = order === 'ascending' ? 1 : -1
  return [...tableData.value].sort((a, b) => {
    if (prop === 'date') {
      const aTime = a.date ? new Date(String(a.date).replace(/年|月/g, '/').replace(/日/g, '')).getTime() : 0
      const bTime = b.date ? new Date(String(b.date).replace(/年|月/g, '/').replace(/日/g, '')).getTime() : 0
      return (aTime - bTime) * direction
    }

    if (prop === 'price') {
      const aPrice = Number(a.price) || 0
      const bPrice = Number(b.price) || 0
      return (aPrice - bPrice) * direction
    }

    const aVal = a[prop]
    const bVal = b[prop]
    if (aVal === bVal) return 0
    return (String(aVal).localeCompare(String(bVal))) * direction
  })
})
const pagedTableData = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return sortedTableData.value.slice(start, end)
})

const handlePageChange = (page) => {
  pageLoading.value = true
  currentPage.value = page
  setTimeout(() => {
    pageLoading.value = false
  }, 220)
}

const handleSortChange = ({ prop, order }) => {
  sortState.value = { prop, order }
  currentPage.value = 1
}

const tableRowStyle = ({ rowIndex }) => {
  if (rowIndex % 2 === 0) {
    return { backgroundColor: 'rgba(226, 239, 255, 0.68)' }
  }
  return { backgroundColor: 'rgba(255, 255, 255, 0.78)' }
}

const resetTicketForm = () => {
  Object.assign(ticket, createDefaultTicket())
  credit.value = false
  value3.value = false
}

const openCreateDialog = () => {
  editingTicketId.value = null
  resetTicketForm()
  dialogFormVisible1.value = true
}

const openEditDialog = (row) => {
  if (!row?.id) {
    ElMessage.error('缺少记录ID，无法编辑')
    return
  }

  const seatTypeRaw = row.seatType || ''
  const seatTypeClean = seatTypeRaw.startsWith('新空调')
    ? seatTypeRaw.replace(/^新空调/, '')
    : seatTypeRaw

  editingTicketId.value = row.id
  Object.assign(ticket, createDefaultTicket(), {
    number: row.number || '',
    from: row.from || '',
    to: row.to || '',
    trainNo: row.trainNo || '',
    date: row.date || '',
    time: row.time || '',
    price: row.price ?? '',
    seatType: seatTypeClean,
    seatNo: row.seatNo || '',
    sellPlace: row.sellPlace || '',
    gate: row.gate || '',
    message: row.message || DEFAULT_TICKET_MESSAGE,
    theme: row.theme || DEFAULT_TICKET_THEME,
    distance: row.distance ?? '',
  })

  credit.value = Number(row.useCredit) === 1
  value3.value = Number(row.hasConditioner) === 1 || seatTypeRaw.startsWith('新空调')

  dialogFormVisible1.value = true
}

const generateDownloadQRCode = async (text) => {
  if (!text) {
    downloadQrCodeUrl.value = ''
    return
  }
  try {
    downloadQrCodeUrl.value = await QRCode.toDataURL(
      text,
      { width: 300, margin: 1, color: { dark: '#000000', light: '#0000' } }
    )
  } catch (err) {
    downloadQrCodeUrl.value = ''
  }
}

const downloadHistoryPNG = async (row) => {
  if (!hasRequiredTicketFields(row)) {
    ElMessage.warning('该记录信息不完整，无法下载')
    return
  }

  Object.assign(downloadTicket, {
    number: row.number,
    from: row.from,
    to: row.to,
    trainNo: row.trainNo,
    date: row.date,
    time: row.time,
    price: row.price,
    seatType: row.seatType,
    seatNo: row.seatNo,
    sellPlace: row.sellPlace,
    gate: row.gate,
    message: row.message,
    theme: row.theme,
    specialTicketType: row.useCredit ? '◯' : '',
    useCredit: row.useCredit ? '赠' : '',
  })

  await generateDownloadQRCode(row.number)

  try {
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const element = historyTicketRef.value
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: null })
    const imgData = canvas.toDataURL('image/png')

    const link = document.createElement('a')
    link.href = imgData
    link.download = `${row.number}.png`
    link.click()
  } catch (err) {
    ElMessage.error('下载失败')
  }
}

const deleteHistory = async (row) => {
  if (!row?.id) {
    ElMessage.error('缺少记录ID，无法删除')
    return
  }

  try {
    await ElMessageBox.confirm(
      '此操作将删除这条记录，该过程不可逆！',
      '删除记录',
      {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        type: 'warning',
      }
    )

    const res = await api.delete(`/ticket/delete/${row.id}`)

    if (res?.data?.success) {
      ElMessage.success('记录已删除')
      await loadTickets()
    } else {
      ElMessage.error(res?.data?.message || '删除失败')
    }
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error('删除失败')
    }
  }
}

const username = ref('')

onMounted(() => {
  const user = JSON.parse(localStorage.getItem('user'))

  if (user) {
    username.value = user.username
  }

  loadTickets()
})

const saveDistance = ref(false)
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
    const payload = buildTicketPayload(ticket, {
      userId: currentUser.id,
      useCredit: credit.value,
      finalSeatType: finalSeatType.value,
      hasConditioner: value3.value,
      distance: ticket.distance,
    })

    const res = isEditMode.value
      ? await api.post(`/ticket/update/${editingTicketId.value}`, payload)
      : await api.post('http://localhost:3000/api/ticket/add', payload)

    if (res.data.success) {
      ElMessage.success(isEditMode.value ? '记录更新成功' : '车票保存成功')
      dialogFormVisible1.value = false
      await loadTickets()
      editingTicketId.value = null
      saveDistance.value = false
    } else {
      ElMessage.error(res.data.message)
    }
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '保存失败')
  }
}

const loadTickets = async () => {
  const currentUser = getCurrentUser()
  if (!currentUser) return

  try {
    const res = await api.get(`/ticket/list/${currentUser.id}`)

    tickets.value = Array.isArray(res?.data?.data)
      ? res.data.data
      : (Array.isArray(res?.data) ? res.data : [])
    currentPage.value = 1

    trips.value = tickets.value.length
    distance.value = tickets.value.reduce(
      (sum, ticket) => sum + (ticket.distance || 0),
      0
    )
    money.value = tickets.value
      .filter(ticket => ticket.use_credit === 0)
      .reduce(
        (sum, ticket) => sum + (ticket.price || 0),
        0
      )
  } catch (err) {
    console.log(err)
    ElMessage.error('读取车票失败')
  }
}
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
}
</style>


<style scoped>
@import "../assets/styles/App.css";
@import "../assets/styles/History.css";

.history-download-render {
  position: fixed;
  left: -9999px;
  top: 0;
  pointer-events: none;
}

.history-page {
  min-height: 100vh;
  background:
      radial-gradient(circle at 8% 10%, rgba(255, 186, 73, 0.22), transparent 40%),
      radial-gradient(circle at 92% 92%, rgba(61, 162, 255, 0.2), transparent 42%),
      linear-gradient(160deg, #f6f8fb 0%, #eef3ff 100%);
}

.history-layout {
  min-height: 100vh;
}

.table-shell :deep(.el-table) {
  --el-table-header-bg-color: rgba(227, 236, 251, 0.9);
  --el-table-tr-bg-color: transparent;
  --el-table-row-hover-bg-color: rgba(176, 214, 255, 0.35);
  --el-table-border-color: rgba(131, 152, 176, 0.28);
  border-radius: 12px;
  overflow: hidden;
}

.table-shell :deep(.el-table th.el-table__cell) {
  color: #1f3e5a;
  font-weight: 700;
}

.table-shell :deep(.el-table td.el-table__cell) {
  border-bottom: 1px solid rgba(131, 152, 176, 0.2);
}
</style>
