<script setup>
import { ref, watchPostEffect } from 'vue'
import { demoFields } from './demoFields.js'

const props = defineProps({ count: { type: Number, required: true } })
const panel = ref(null)
watchPostEffect(() => {
  const list = panel.value
  if (!list) return
  const item = list.children[Math.max(0, props.count - 1)]
  list.scrollTop = Math.max(0, item.offsetTop + item.offsetHeight - list.clientHeight)
})
</script>

<template>
  <div class="form-preview">
    <strong>车票信息</strong>
    <dl ref="panel">
      <div v-for="([key, label, value], i) in demoFields" :key="key" :class="{ wide: label === '提示语' }">
        <dt>{{ label }}</dt>
        <dd>{{ i < count ? value : '　' }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.form-preview {
  padding: clamp(14px, 2vw, 26px);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  background: var(--el-bg-color);
  box-shadow: var(--el-box-shadow-light);
}
dl {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  max-height: 43svh;
  overflow: hidden;
  margin: 16px 0 0;
}
dl > div { grid-column: span 2; }
dl > div:nth-child(8), dl > div:nth-child(9) { grid-column: span 1; }
dl > .wide { grid-column: 1 / -1; }
dt {
  margin-bottom: 4px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
dd {
  margin: 0;
  padding: 5px 8px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  font-size: 14px;
}
@media (prefers-reduced-motion: reduce), (max-height: 500px) {
  dl { max-height: none; }
}
</style>

