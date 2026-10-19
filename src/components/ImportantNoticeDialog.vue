<template>
  <el-dialog
    v-model="visible"
    title="重要通知"
    :z-index="3000"
    width="min(640px, calc(100vw - 32px))"
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @closed="emit('closed')"
  >
    <div class="important-notice">
      <h3>中国铁路即将开始调整车次规则</h3>
      <p>根据新闻稿，将新增X开头列车，Z, T, K, 普车将更改为Z, N, V字头车。</p>
      <p>因此，本站规则更新时间如下：</p>
      <ul>
        <li>即日起 ~ 2026.11.25：维持现有规则；</li>
        <li>
          <strong>2026.11.25</strong>（预计）起开车的车票，同时保留现有规则，新增允许N、V开头列车；
        </li>
        <li>
          <strong>2026.12.XX</strong>起，新增对X等车次的支持，同时保留现有规则，此时到下一阶段站点将允许两套规则；
        </li>
        <li>
          <strong>2027.01.15</strong>（预计）起，将删除旧规则，您将可能无法生成旧规则的车票。
        </li>
      </ul>
      <p>如有发现错误，请在项目主页提交Issues。</p>
    </div>
    <template #footer>
      <el-button type="primary" @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
const visible = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['closed'])
</script>

<style scoped>
.important-notice {
  max-height: 60vh;
  overflow-y: auto;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.important-notice h3 {
  margin: 0 0 16px;
  color: var(--el-text-color-primary);
}

.important-notice p {
  margin: 0 0 12px;
}

.important-notice ul {
  margin: 0 0 12px;
  padding-left: 24px;
}

.important-notice li + li {
  margin-top: 12px;
}
</style>
