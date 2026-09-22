<script setup>
import { themeOptions, useTheme } from '@/composables/useTheme'

const { preference } = useTheme()
</script>

<template>
  <el-select v-model="preference" class="theme-select" aria-label="外观主题" title="外观主题">
    <el-option
      v-for="option in themeOptions"
      :key="option.value"
      :label="option.label"
      :value="option.value"
    />
  </el-select>
</template>

<style scoped>
.theme-select {
  width: 190px;
  flex: 0 0 190px;
}
</style>
