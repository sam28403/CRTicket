<script setup>
import { computed, ref } from 'vue'
import AppBrand from '@/components/AppBrand.vue'
import ThemeSelect from '@/components/ThemeSelect.vue'
import StationBoardTable from '@/components/StationBoardTable.vue'
import { queryStationSearch } from '@/composables/useTicketShared.js'
import { useStationBoard } from '@/composables/useStationBoard.js'
import { boardTabs, stationBoardRows } from '@/utils/stationBoard.js'

const { station, clock, loading, result, error, query } = useStationBoard()
const activeTab = ref('all')
const follow = ref(true)
const table = ref(null)
// 时间更新不重新遍历和排序车次；仅查询结果和标签变化时重算。
const rows = computed(() => stationBoardRows(result.value?.trains || [], activeTab.value))
const updatedTime = computed(() => result.value
  ? new Date(result.value.generatedAt).toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai', hour12: false,
  }) : '')
const warningSummary = computed(() => {
  if (!result.value?.warnings?.length) return ''
  return result.value.source === '路路通'
    ? '12306 未取得数据，当前为离线参考；请以车站公告为准。'
    : result.value.warnings.join(' ')
})

function locateCurrent() {
  follow.value = true
  table.value?.locateCurrent()
}
</script>

<template>
  <div class="station-page">
    <el-header class="top-header">
      <AppBrand />
      <div class="page-header-actions"><ThemeSelect /></div>
    </el-header>
    <main class="station-content">
      <div class="page-heading">
        <h1>车站大屏</h1>
        <el-form class="station-form" @submit.prevent="query()">
          <el-form-item label="站名">
            <el-autocomplete
              v-model="station"
              :fetch-suggestions="queryStationSearch"
              placeholder="输入站名或拼音"
              clearable
              :maxlength="30"
              aria-label="查询车站"
            />
          </el-form-item>
          <el-form-item class="query-action">
            <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
          </el-form-item>
        </el-form>
        <div class="heading-actions">
          <time class="system-clock">北京时间 {{ clock.date }} {{ clock.time }}</time>
          <el-button @click="$router.push('/train')">车次查询</el-button>
        </div>
      </div>

      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        class="query-message"
      />
      <el-card
        v-loading="loading"
        shadow="never"
        class="results"
        element-loading-text="正在查询当天车站信息…"
      >
        <template v-if="result">
          <div class="result-heading">
            <div class="result-summary">
              <strong>{{ result.station }} · {{ result.date }}</strong>
              <el-text type="info" size="small">
                共 {{ result.total.toLocaleString() }} 趟 · {{ result.source }}
                <template v-if="result.version"> {{ result.version }}</template>
                · 更新于 {{ updatedTime }}
              </el-text>
              <el-tooltip
                v-if="warningSummary"
                :content="result.warnings.join(' ')"
                placement="top-start"
                :show-after="300"
              >
                <el-text class="warning-note" type="info" size="small">
                  {{ warningSummary }}
                </el-text>
              </el-tooltip>
            </div>
            <div class="board-actions">
              <el-switch v-model="follow" active-text="跟随当前时间" />
              <el-button @click="locateCurrent">定位当前时间</el-button>
            </div>
          </div>
          <el-tabs v-model="activeTab">
            <el-tab-pane
              v-for="tab in boardTabs"
              :key="tab.name"
              :label="tab.label"
              :name="tab.name"
            />
          </el-tabs>
          <div class="board-description">
            <el-text type="info" size="small">
              当前显示 {{ rows.length.toLocaleString() }} 趟，按本站到发时间排序。
              手动滚动后暂停跟随，可点击“定位当前时间”恢复。
            </el-text>
          </div>
          <StationBoardTable
            ref="table"
            :rows="rows"
            :tab="activeTab"
            :current-minutes="clock.minutes"
            :follow="follow"
            :source="result.source"
            :date="result.date"
            @browse="follow = false"
          />
        </template>
        <el-empty
          v-else
          :description="loading
            ? '正在获取车站时刻表'
            : error ? '查询未完成，请重试' : '输入站名查询当天到发信息'"
        />
      </el-card>
    </main>
  </div>
</template>

<style scoped src="@/assets/styles/station.css"></style>
