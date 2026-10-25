<script setup>
import { computed, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import AppBrand from '@/components/AppBrand.vue'
import ThemeSelect from '@/components/ThemeSelect.vue'
import { airTypes, calculateFareByGrade, fareGrades } from '@/utils/ordinaryFare.js'

const grade = ref('快速')
const air = ref('new')
const page = ref(1)
const pageSize = ref(50)
const maxDistance = 5000
const compactTable = useMediaQuery('(max-width: 600px)')
const columns = calculateFareByGrade({ grade: '快速', air: 'new', distance: 1 })
  .fares.map(fare => fare.seat)
const rows = computed(() => {
  const start = (page.value - 1) * pageSize.value + 1
  const end = Math.min(start + pageSize.value - 1, maxDistance)
  return Array.from({ length: end - start + 1 }, (_, index) => calculateFareByGrade({
    grade: grade.value,
    air: air.value,
    distance: start + index,
  }))
})

watch([grade, air, pageSize], () => { page.value = 1 }, { flush: 'sync' })
</script>

<template>
  <div class="price-page">
    <el-header class="top-header">
      <AppBrand />
      <div class="page-header-actions"><ThemeSelect /></div>
    </el-header>
    <main class="price-content">
      <div class="page-heading">
        <h1>价格列表</h1>
        <div class="page-header-actions">
          <el-button @click="$router.push('/price')">票价计算</el-button>
        </div>
      </div>
      <el-card shadow="never">
        <el-form label-position="top" class="list-controls">
          <el-form-item label="计价等级">
            <el-radio-group v-model="grade" aria-label="计价等级">
              <el-radio-button v-for="item in fareGrades" :key="item" :value="item">
                {{ item }}
              </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="空调类型" class="air-field">
            <el-radio-group v-model="air" aria-label="空调类型">
              <el-radio-button v-for="type in airTypes" :key="type.value" :value="type.value">
                {{ type.value === 'none' ? '无空调' : type.label }}
              </el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </el-card>
      <el-card shadow="never" class="price-results">
        <template #header>
          <div class="result-heading">
            <h2>参考票价（元）</h2>
          </div>
        </template>
        <el-table :data="rows" row-key="distance" stripe border height="560" class="price-list-table">
          <el-table-column
              prop="distance"
              label="里程（公里）"
              :width="compactTable ? undefined : 120"
              :min-width="compactTable ? 1 : 120"
              :fixed="!compactTable"
              align="center"
          >
            <template #header>
              <span class="column-heading">{{ compactTable ? '里程\n公里' : '里程（公里）' }}</span>
            </template>
          </el-table-column>
          <el-table-column
              v-for="(seat, index) in columns"
              :key="seat"
              :label="seat"
              :min-width="compactTable ? 1 : 120"
              align="center"
          >
            <template #header>
              <span class="column-heading">{{ compactTable ? seat.replace('卧', '卧\n') : seat }}</span>
            </template>
            <template #default="{ row }">{{ row.fares[index].price.toFixed(1) }}</template>
          </el-table-column>
        </el-table>
        <div class="list-pagination">
          <el-select v-model="pageSize" aria-label="每页条数">
            <el-option v-for="size in [50, 100, 200]" :key="size" :value="size" :label="`${size} 条/页`" />
          </el-select>
          <el-pagination
              v-model:current-page="page"
              :page-size="pageSize"
              :total="maxDistance"
              :pager-count="5"
              layout="prev, pager, next, jumper"
              background
          />
        </div>
      </el-card>
      <p class="fare-note">不适用快慢列车与青藏线上浮票价的车次。</p>
    </main>
  </div>
</template>

<style scoped src="@/assets/styles/price.css"></style>

<style scoped>
.list-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 20px 32px;
}

.list-controls .el-form-item {
  margin-bottom: 0;
}

.list-controls .air-field {
  width: 300px;
  max-width: 100%;
}

.list-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 20px;
}

.list-pagination .el-select {
  width: 120px;
}

@media (max-width: 600px) {
  .price-results :deep(.el-card__body) {
    padding: 12px 8px;
  }

  .price-list-table {
    font-size: clamp(9px, 2.6vw, 12px);
    font-variant-numeric: tabular-nums;
  }

  .price-list-table :deep(.cell) {
    padding: 0 1px;
    line-height: 18px;
    white-space: nowrap;
  }

  .column-heading {
    display: block;
    white-space: pre-line;
    font-size: 11px;
    line-height: 16px;
  }

  .list-pagination {
    justify-content: flex-start;
  }

  .list-pagination :deep(.el-pagination) {
    flex-wrap: wrap;
    row-gap: 12px;
  }
}

</style>
