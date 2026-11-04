<script setup>
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme.js'

const { isDark } = useTheme()
const screenshot = computed(() =>
  `${import.meta.env.BASE_URL}Phone_${isDark.value ? 'Dark' : 'Light'}.PNG`)
const projectUrl = 'https://github.com/sam28403/CRTicket-Android'
</script>

<template>
  <section class="android-preview" aria-labelledby="android-title">
    <figure>
      <img :src="screenshot" alt="CRTicket Android 版本主界面" loading="lazy">
    </figure>
    <div class="android-copy">
      <h2 id="android-title">Android版本已准备好</h2>
      <div class="android-actions">
        <el-button tag="a" size="large" :href="projectUrl">查看项目</el-button>
        <el-button tag="a" type="primary" size="large" :href="`${projectUrl}/releases/latest`">
          下载最新版本
        </el-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.android-preview {
  display: grid;
  grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
  align-items: center;
  gap: clamp(24px, 6vw, 80px);
  max-width: 1140px;
  margin: auto;
  padding: clamp(48px, 7vw, 96px) clamp(20px, 5vw, 64px);
  padding-top: 24px;
}
figure { margin: 0; text-align: center; }
img { display: block; width: min(100%, 320px); height: auto; margin: auto; }
.android-copy { min-width: 0; }
.android-actions { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 28px; }
.android-actions .el-button + .el-button { margin-left: 0; }
a.el-button,
a.el-button:hover,
a.el-button:focus-visible,
a.el-button:active { text-decoration: none; }
@media (max-width: 700px) {
  .android-preview { grid-template-columns: minmax(0, 1fr); }
  .android-copy { order: -1; }
  img { width: min(100%, 280px); }
}
</style>
