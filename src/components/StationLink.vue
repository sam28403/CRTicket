<script setup>
import { RouterLink } from 'vue-router'
import { stationLocation } from '@/utils/stationNavigation.js'

defineProps({ name: { type: String, required: true } })
</script>

<template>
  <RouterLink
    :to="stationLocation(name)"
    class="station-link"
    :title="`查看${name.trim()}的当天车站大屏`"
  >
    {{ name }}
  </RouterLink>
</template>

<style scoped>
.station-link {
  color: var(--el-color-primary);
  text-decoration: none;
}
.station-link:hover {
  text-decoration: underline;
}
</style>
