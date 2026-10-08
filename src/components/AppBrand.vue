<template>
  <RouterLink to="/" class="header-brand" aria-label="返回首页" title="返回首页">
    <el-avatar src="Picture1.png" />
    <h2>Sam-Lab CR Ticket Maker</h2>
  </RouterLink>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.header-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  text-decoration: none;
  border-radius: 4px;
}

.header-brand h2 {
  margin: 0;
  font-family: 'Roboto', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 20px;
}

@media (max-width: 800px) {
  .header-brand h2 { font-size: 15px; }
}
</style>
