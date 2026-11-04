<script setup>
import { formatStationName, getStationEnglish } from '@/composables/useTicketShared.js'

defineProps({
  ticket: { type: Object, required: true },
  finalSeatType: String,
  specialTicketType: String,
  useCredit: String,
  qrCodeUrl: String,
})
</script>

<template>
  <div class="ticket-container">
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
</template>

<style scoped src="@/assets/styles/ticketArtwork.css"></style>
