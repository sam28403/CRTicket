<script setup>
import ThemeSelect from '@/components/ThemeSelect.vue'
import AppBrand from '@/components/AppBrand.vue'
import { computed } from 'vue'
import { useUserStore } from '@/stores/user.js'
import { useDebugGeneration } from '@/composables/useDebugGeneration.js'

const userStore = useUserStore()
userStore.init()

const currentUser = computed(() => {
  if (!userStore.isLogin) return null
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
})
const userLabel = computed(() => currentUser.value?.username || '')
const {
  generationCount, departureDate, isGenerating, generatedTickets,
  progress, dataNotice, disabledDate, handleGenerate,
} = useDebugGeneration(currentUser)
</script>

<template>
  <div class="debug-page">
    <header class="debug-header">
      <AppBrand />
      <div class="page-header-actions"><ThemeSelect /></div>
    </header>
    <header class="debug-hero">
      <div>
        <p class="eyebrow">Debug Workspace</p>
        <h1>真实运转数据生成器</h1>
        <p class="subtitle">
          根据 12306 在线时刻、席别和票价，以及路路通里程，按当前登录用户批量生成并保存车票。
        </p>
      </div>

      <div class="user-card">
        <span class="user-label">当前登录用户</span>
        <strong v-if="userLabel">{{ userLabel }}</strong>
        <strong v-else>未登录</strong>
        <span class="user-hint" v-if="!userStore.isLogin">请先登录后再操作</span>
        <span class="user-hint" v-else>车票将保存到该账号下</span>
      </div>
    </header>

    <section class="control-panel">
      <div class="control-row">
        <div class="input-wrap">
          <label for="ticket-count">生成数量</label>
          <el-input-number
            id="ticket-count"
            v-model="generationCount"
            :min="1"
            :max="1000"
            :step="1"
            :disabled="isGenerating"
            controls-position="right"
          />
        </div>

        <div class="input-wrap">
          <label for="departure-date">列车始发日期</label>
          <el-date-picker
            id="departure-date"
            v-model="departureDate"
            type="date"
            value-format="YYYY-MM-DD"
            :clearable="false"
            :disabled="isGenerating"
            :disabled-date="disabledDate"
          />
        </div>

        <el-button
          type="primary"
          size="large"
          :loading="isGenerating"
          :disabled="!userStore.isLogin"
          @click="handleGenerate"
        >
          确定生成
        </el-button>
      </div>

      <el-alert
        title="只生成能核验车次、站序、时刻、里程、席别和票价的记录。中途上车日期按跨日顺延；背景、票号和座位号随机，检票候车留空，售票统一为“网”，不使用积分，不添加未经核实的“新空调”标记。"
        type="info"
        show-icon
        :closable="false"
      />
      <p v-if="progress" class="generation-note" role="status">{{ progress }}</p>
      <p v-if="dataNotice" class="generation-note" role="status">{{ dataNotice }}</p>
    </section>

    <section class="result-panel">
      <div class="panel-head">
        <h2>生成结果</h2>
        <span v-if="generatedTickets.length">共 {{ generatedTickets.length }} 条</span>
      </div>

      <el-empty v-if="!generatedTickets.length" description="还没有生成任何车票" />

      <el-table
        v-else
        :data="generatedTickets"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="index" label="#" width="70" />
        <el-table-column prop="number" label="票号" width="170" />
        <el-table-column prop="trainNo" label="车次" width="100" />
        <el-table-column label="起终点" min-width="180">
          <template #default="{ row }">
            {{ row.from }} → {{ row.to }}
          </template>
        </el-table-column>
        <el-table-column prop="date" label="日期" width="140" />
        <el-table-column prop="time" label="时间" width="100" />
        <el-table-column label="票价" width="100">
          <template #default="{ row }">
            ￥{{ row.price }}
          </template>
        </el-table-column>
        <el-table-column label="席位" width="120">
          <template #default="{ row }">
            {{ row.finalSeatType }}
          </template>
        </el-table-column>
        <el-table-column prop="seatNo" label="座位号" width="120" />
        <el-table-column prop="distance" label="里程（km）" width="110" />
        <el-table-column prop="source" label="数据来源" width="160" />
        <el-table-column prop="mileageVersion" label="里程版本" width="120" />
        <el-table-column prop="saveStatus" label="保存" width="90" />
        <el-table-column prop="saveMessage" label="说明" min-width="140" />
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.debug-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.debug-page {
  min-height: 100vh;
  padding: 32px;
  background: var(--app-page, radial-gradient(circle at top left, rgba(79, 140, 255, 0.18), transparent 28%),
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.16), transparent 24%),
    linear-gradient(180deg, #f7f9fc 0%, #eef3f8 100%));
  color: var(--app-text, #162033);
}

.debug-hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 700;
  color: var(--app-muted, #5f6f8f);
}

.debug-hero h1 {
  margin: 0;
  font-size: 36px;
  line-height: 1.1;
}

.subtitle {
  max-width: 720px;
  margin: 12px 0 0;
  font-size: 15px;
  color: var(--app-muted, #52617d);
}

.user-card {
  min-width: 220px;
  padding: 18px 20px;
  border-radius: 18px;
  background: var(--app-surface, rgba(255, 255, 255, 0.86));
  box-shadow: 0 14px 35px rgba(22, 32, 51, 0.08);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-label {
  font-size: 12px;
  color: var(--app-muted, #6d7a92);
}

.user-hint {
  font-size: 13px;
  color: var(--app-muted, #7f8ba3);
}

.control-panel,
.result-panel {
  padding: 20px;
  border-radius: 20px;
  background: var(--app-surface, rgba(255, 255, 255, 0.88));
  box-shadow: 0 16px 40px rgba(22, 32, 51, 0.08);
  backdrop-filter: blur(10px);
}

.control-panel {
  margin-bottom: 24px;
}

.control-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.input-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-wrap label {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text, #334155);
}

.generation-note {
  margin: 12px 0 0;
  font-size: 14px;
  color: var(--app-muted, #52617d);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-head h2 {
  margin: 0;
  font-size: 22px;
}

.panel-head span {
  color: var(--app-muted, #6b7280);
  font-size: 14px;
}

@media (max-width: 900px) {
  .debug-page {
    padding: 18px;
  }

  .debug-hero {
    flex-direction: column;
  }

  .user-card {
    width: 100%;
  }
}
</style>
