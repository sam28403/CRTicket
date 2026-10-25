<script setup>
import { computed, ref, watch } from 'vue'
import AppBrand from '@/components/AppBrand.vue'
import ThemeSelect from '@/components/ThemeSelect.vue'
import { isGithubPagesBuild } from '@/config/deploy.js'
import { airTypes, calculateOrdinaryFare, getPriceTrainGrade } from '@/utils/ordinaryFare.js'

const train = ref('')
const air = ref('new')
const distance = ref('')
const submitted = ref(false)
const result = ref(null)
const grade = computed(() => getPriceTrainGrade(train.value))
const trainError = computed(() => {
  if (!submitted.value && !train.value) return ''
  if (!train.value.trim()) return '请输入车次'
  return grade.value ? '' : '请输入支持的普速车次'
})
const distanceError = computed(() => {
  if (!submitted.value && !distance.value) return ''
  return /^[1-9]\d*$/.test(distance.value) && Number(distance.value) <= 5000
    ? '' : '请输入 1 至 5000 的整数里程'
})

watch([train, air, distance], () => { result.value = null })

function calculate() {
  submitted.value = true
  if (trainError.value || distanceError.value) return
  result.value = calculateOrdinaryFare({
    train: train.value,
    air: air.value,
    distance: Number(distance.value),
  })
}
</script>

<template>
  <div class="price-page">
    <el-header class="top-header">
      <AppBrand />
      <div class="page-header-actions"><ThemeSelect /></div>
    </el-header>
    <main class="price-content">
      <div class="page-heading">
        <h1>普速票价计算</h1>
        <div class="page-header-actions">
          <el-button v-if="!isGithubPagesBuild" @click="$router.push('/train')">车次查询</el-button>
          <el-button @click="$router.push('/price/list')">价格列表</el-button>
        </div>
      </div>
      <el-card shadow="never">
        <el-form label-position="top" class="price-form" @submit.prevent="calculate">
          <el-form-item label="车次" :error="trainError">
            <el-input
              v-model="train"
              placeholder="例如 Z1、N1、V6001"
              maxlength="5"
              clearable
              aria-label="车次"
            />
          </el-form-item>
          <el-form-item label="空调类型" class="air-field">
            <el-radio-group v-model="air" aria-label="空调类型">
              <el-radio-button v-for="type in airTypes" :key="type.value" :value="type.value">
                {{ type.label }}
              </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="里程" :error="distanceError">
            <el-input v-model="distance" placeholder="输入里程" inputmode="numeric" aria-label="里程">
              <template #append>公里</template>
            </el-input>
          </el-form-item>
          <el-form-item class="price-action">
            <el-button type="primary" native-type="submit">计算票价</el-button>
          </el-form-item>
        </el-form>
        <div v-if="grade" class="identified-grade">
          <span>计价等级</span>
          <el-tag effect="plain">{{ grade }}</el-tag>
        </div>
      </el-card>
      <el-card shadow="never" class="price-results" aria-live="polite">
        <template #header>
          <div class="result-heading">
            <h2>参考票价</h2>
          </div>
        </template>
        <div v-if="result" class="fare-grid">
          <div v-for="fare in result.fares" :key="fare.seat" class="fare-card">
            <h3>{{ fare.seat }}</h3>
            <div class="fare-amount">
              <span class="fare-currency">¥</span>
              <span class="fare-value">{{ fare.price.toFixed(1) }}</span>
            </div>
          </div>
        </div>
        <el-empty v-else description="输入车次和里程后计算参考票价" :image-size="100" />
      </el-card>
      <p class="fare-note">
        暂不支持查询快慢列车与青藏线上浮票价的车次。
      </p>
    </main>
  </div>
</template>

<style scoped src="@/assets/styles/price.css"></style>
