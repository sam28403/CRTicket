<script setup>
import ArchiveCharts from './ArchiveCharts.vue'
defineProps({ tickets: { type: Array, required: true } })
</script>

<template>
  <ArchiveCharts :tickets="tickets" map />
</template>
