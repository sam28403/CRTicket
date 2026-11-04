<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ tickets: { type: Array, required: true } })
const baseUrl = import.meta.env.BASE_URL
const order = ref('descending')
const sortKey = ref('date')
const rows = computed(() => props.tickets.map(ticket => ({
  date: ticket.travel_date,
  trainNo: ticket.train_no,
  price: ticket.price,
  from: ticket.departure_station,
  to: ticket.arrival_station,
  seatType: ticket.seat_type,
  seatNo: ticket.seat_no,
})).sort((a, b) => {
  const comparison = sortKey.value === 'price'
    ? a.price - b.price : a.date.localeCompare(b.date)
  return order.value === 'ascending' ? comparison : -comparison
}))
const pagedRows = computed(() => rows.value.slice(0, 10))
const distance = computed(() => props.tickets.reduce((sum, ticket) => sum + (ticket.distance || 0), 0))
const money = 9479.5
function sortChanged({ prop, order: value }) {
  sortKey.value = prop || 'date'
  order.value = value || 'descending'
}
</script>

<template>
  <div class="history-preview">
    <el-card class="user-card" shadow="never">
      <div class="card-container">
        <el-avatar :size="100" :src="`${baseUrl}Picture1.png`" />
        <div class="card-content">
          <h1>Hi, 旅行者</h1>
          <p>
            你已经运转了 <span class="highlight">{{ tickets.length }}</span> 次，
            <span class="highlight">{{ distance }}</span> 公里，
            共消费 <span class="highlight">{{ money }}</span> 元！
          </p>
        </div>
      </div>
    </el-card>
    <div class="table-shell">
      <el-table
        :data="pagedRows"
        :default-sort="{ prop: 'date', order: 'descending' }"
        class="table"
        @sort-change="sortChanged"
      >
        <el-table-column prop="date" label="日期" width="160" sortable="custom" />
        <el-table-column prop="trainNo" label="车次" width="80" />
        <el-table-column prop="price" label="票价" width="80" sortable="custom" />
        <el-table-column prop="from" label="起点" min-width="120" />
        <el-table-column prop="to" label="终点" min-width="120" />
        <el-table-column prop="seatType" label="席位" width="120" />
        <el-table-column prop="seatNo" label="座位" width="150" />
      </el-table>
    </div>
    <ol class="mobile-records" aria-label="历史车票">
      <li v-for="(row, index) in pagedRows" :key="index" class="mobile-record">
        <div class="record-heading">
          <strong>{{ row.trainNo }}</strong>
          <time>{{ row.date }}</time>
        </div>
        <div class="record-route">{{ row.from }} → {{ row.to }}</div>
        <dl>
          <div><dt>票价</dt><dd>¥{{ row.price }}</dd></div>
          <div><dt>席位</dt><dd>{{ row.seatType }}</dd></div>
          <div class="record-seat"><dt>座位</dt><dd>{{ row.seatNo || '—' }}</dd></div>
        </dl>
      </li>
    </ol>
  </div>
</template>

<style scoped>
@import '@/assets/styles/History.css';
.user-card { height: auto; }
.card-container { flex-wrap: wrap; }
.card-content { flex: 1; min-width: 200px; }
.card-content h1 { font-size: clamp(24px, 4vw, 48px); }
.card-content p { margin-bottom: 0; font-size: 18px; }
.highlight { font-size: clamp(24px, 3vw, 38px); }
.history-preview { min-width: 0; }
.table-shell { min-width: 0; overflow: hidden; }
.mobile-records { display: none; }
@media (max-width: 600px) {
  .card-container {
    padding: 0;
    gap: 16px;
  }
  .card-content {
    min-width: 0;
    flex-basis: 100%;
  }
  .user-card { padding: 0; }
  .table-shell { padding: 4px; }
  .card-content p { font-size: 15px; line-height: 1.8; }
  .card-container :deep(.el-avatar) { width: 64px; height: 64px; }
  .card-content h1 { font-size: 26px; }
  .highlight { font-size: 24px; }
  .table-shell { display: none; }
  .mobile-records {
    display: grid;
    gap: 12px;
    padding: 0;
    margin: 16px 0 0;
    list-style: none;
  }
  .mobile-record {
    padding: 16px;
    border: 1px solid var(--el-border-color);
    border-radius: 12px;
    background: var(--el-bg-color);
    font-size: 14px;
  }
  .record-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .record-heading strong { color: var(--el-color-primary); font-size: 18px; }
  time { font-size: 12px; color: var(--el-text-color-regular); }
  .record-route { margin: 16px 0; font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
  dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0; }
  dt { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
  dd { margin: 0; overflow-wrap: anywhere; }
  .record-seat { grid-column: 1 / -1; }
}
</style>
