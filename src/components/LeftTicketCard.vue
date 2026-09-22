<script setup>
import { computed } from 'vue'
import { hasAvailableSeat as hasTicket, hasPlentyOfSeats as hasPlenty, isKnownSeat } from '@/utils/seatAvailability.js'

const props = defineProps({
  train: {
    type: Object,
    required: true,
  },
  columns: {
    type: Array,
    required: true,
  },
})

const trainParts = computed(() => {
  const match = props.train.train.match(/^([A-Za-z]+)(.*)$/)
  return match
    ? { prefix: match[1], number: match[2] }
    : { prefix: '', number: props.train.train }
})

const seats = computed(() =>
  props.columns.filter(([key]) => {
    const value = props.train.seats[key]
    return isKnownSeat(value)
  })
)

const borderClass = computed(() => {
  const knownSeats = props.columns
    .map(([key]) => [key, props.train.seats[key]])
    .filter(([, value]) =>
      isKnownSeat(value)
    )
  const availableSeats = knownSeats.filter(([, value]) => hasTicket(value))

  if (knownSeats.length && !availableSeats.length) return 'border-sold-out'

  const availableStanding = availableSeats.some(([key]) => key === 'standing')
  const availableSeated = availableSeats.filter(([key]) => key !== 'standing')
  if (availableStanding && !availableSeated.length) return 'border-standing-only'
  if (availableSeated.some(([, value]) => hasPlenty(value))) return 'border-plenty'

  return ''
})

const duration = computed(() => {
  const match = props.train.duration.match(/^(\d+):(\d+)$/)
  return match ? `${Number(match[1])}h ${Number(match[2])}min` : props.train.duration
})

function countText(value) {
  if (value === '有' || value === '>20') return '>20张'
  if (value === '无') return '0张'
  return /^\d+$/.test(value) ? `${Number(value)}张` : value
}

function countClass(value) {
  if (hasPlenty(value)) return 'plenty'
  if (/^\d+$/.test(value) && Number(value) > 0) return 'limited'
  return value === '无' || value === '0' ? 'sold-out' : 'unknown'
}
</script>

<template>
  <article
    class="ticket-card"
    :class="borderClass"
    :aria-label="`${train.train} ${train.from}至${train.to}`"
  >
    <div class="card-head" :class="{ 'numeric-train': !trainParts.prefix }">
      <span
        v-if="trainParts.prefix"
        class="train-prefix"
        aria-hidden="true"
      >
        {{ trainParts.prefix }}
      </span>
      <span class="train-number" aria-hidden="true">{{ trainParts.number }}</span>
      <div class="journey-time">
        <div>{{ train.departure }}~{{ train.arrival }}</div>
        <div>{{ duration }}</div>
      </div>
      <div class="journey-route">
        {{ train.from }}
        <span class="route-arrow">→</span>
        {{ train.to }}
      </div>
    </div>

    <div v-if="seats.length" class="seat-grid">
      <div v-for="[key, label] in seats" :key="key" class="seat-item">
        <span>{{ label }}</span>
        <span
          :class="countClass(train.seats[key])"
          :title="train.seats[key] === '>20' || train.seats[key] === '有'
            ? '官网未提供可解析的数量'
            : '官网返回数量'"
        >
          {{ countText(train.seats[key]) }}
        </span>
      </div>
    </div>
    <p v-else class="card-status">暂无在售席别数据</p>
    <p
      v-if="!train.canBuy && train.status && train.status !== '预订'"
      class="card-status"
    >
      {{ train.status.replaceAll('预订', '').trim() }}
    </p>
  </article>
</template>

<style scoped>
.ticket-card {
  container-type: inline-size;
  padding: 14px 16px 16px;
  border: 2px solid var(--app-border, #080808);
  border-radius: 24px;
  background: var(--app-surface, #fff);
  color: var(--app-text, #080808);
  font-family: 'Debug2Fangzheng', serif;
}

.ticket-card.border-sold-out {
  border-color: #f56c6c;
}

.ticket-card.border-standing-only {
  border-color: #e6a23c;
}

.ticket-card.border-plenty {
  border-color: #67c23a;
}

.card-head {
  display: grid;
  grid-template-columns: 19% 39% 42%;
  grid-template-rows: auto auto;
  align-items: center;
}

.train-prefix,
.train-number {
  font-family: 'Debug2Consolas', monospace;
  font-weight: 700;
  line-height: 1;
}

.train-prefix {
  grid-column: 1;
  grid-row: 1 / 3;
  font-size: 29cqw;
}

.train-number {
  grid-column: 2;
  grid-row: 1;
  font-size: 17cqw;
  letter-spacing: -0.055em;
}

.journey-time {
  grid-column: 3;
  grid-row: 1;
  font-size: 5.1cqw;
  line-height: 1.65;
  white-space: nowrap;
}

.journey-route {
  grid-column: 2 / 4;
  grid-row: 2;
  overflow-wrap: anywhere;
  font-size: 4.6cqw;
  line-height: 1.45;
}

.route-arrow {
  padding: 0 0.12em;
}

.numeric-train {
  grid-template-columns: 58% 42%;
}

.numeric-train .train-number {
  grid-column: 1;
  font-size: 20cqw;
  letter-spacing: 0;
}

.numeric-train .journey-time {
  grid-column: 2;
}

.numeric-train .journey-route {
  grid-column: 1 / 3;
}

.seat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 7%;
  margin-top: 12px;
}

.seat-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 4.9cqw;
  line-height: 1.35;
}

.seat-item > :last-child {
  white-space: nowrap;
}

.plenty {
  color: var(--app-success, #00b657);
}

.limited {
  color: var(--app-warning, #ca590c);
}

.sold-out {
  color: var(--app-danger, #ec0808);
}

.unknown {
  color: var(--app-muted, #666);
}

.card-status {
  margin: 15px 0 0;
  color: var(--app-muted, #666);
  font-size: 16px;
}

@media (max-width: 600px) {
  .ticket-card {
    padding: 10px 8px;
    border-radius: 16px;
  }
}
</style>

<style scoped>
@container (max-width: 230px) {
  .seat-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
    margin-top: 8px;
  }

  .seat-item {
    gap: 4px;
    font-size: 12px;
  }

  .journey-time {
    font-size: 6cqw;
  }

  .journey-route {
    grid-column: 1 / -1;
    grid-row: 3;
    margin-top: 4px;
    font-size: 12px;
  }

  .card-status {
    margin-top: 8px;
    font-size: 12px;
  }
}
</style>
