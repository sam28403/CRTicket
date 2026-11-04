<script setup>
import { entries } from '@/utils/updateLog.js'
import '@/assets/styles/update-log.css'
import AppBrand from '@/components/AppBrand.vue'
import ThemeSelect from '@/components/ThemeSelect.vue'
import TicketStory from '@/components/overview/TicketStory.vue'
import FeatureChapters from '@/components/overview/FeatureChapters.vue'
import AndroidPreview from '@/components/overview/AndroidPreview.vue'
import GitHubButton from '@/components/overview/GitHubButton.vue'
import { vScrollReveal } from '@/components/overview/scrollReveal.js'
</script>

<template>
  <div class="overview">
    <header>
      <AppBrand />
      <div class="header-actions">
        <ThemeSelect />
        <el-button type="primary" round @click="$router.push('/ticket')">制作车票</el-button>
        <GitHubButton />
      </div>
    </header>
    <main>
      <section class="hero">
        <div class="hero-copy">
          <span>CR TICKET MAKER</span>
          <h1>把旅程<br>留在票面上。</h1>
          <p>从一张自制车票开始，查沿途的列车，收藏自己的铁路足迹。</p>
          <el-button size="large" round @click="$refs.story.scrollIntoView()">
            看一张车票如何生成 ↓
          </el-button>
        </div>
      </section>
      <div ref="story"><TicketStory /></div>
      <FeatureChapters />
      <AndroidPreview v-scroll-reveal />
      <footer>
        <div v-scroll-reveal>
          <h2>下一张，写下你的行程。</h2>
          <el-button type="primary" size="large" round @click="$router.push('/ticket')">
            开始制作车票
          </el-button>
        </div>
        <div v-if="entries.length" v-scroll-reveal class="release">
          <h3>最新更新日志</h3>
          <article class="update-log-entry" v-html="entries[0].html"></article>
        </div>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.overview {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-family: var(--el-font-family);
}
html:not(.dark):not(.high-contrast) .overview {
  --el-color-primary: #1765ad;
  --el-color-primary-light-3: #216db4;
}
header {
  max-width: 1280px;
  margin: auto;
  padding: 12px clamp(12px, 4vw, 54px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.hero {
  display: grid;
  align-items: end;
  min-height: min(76svh, 800px);
  color: white;
  background: linear-gradient(90deg, rgb(8 19 32 / 92%), rgb(8 19 32 / 62%)),
    url('/CR400BF.jpg') center / cover;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  max-width: 100%;
}
.hero-copy {
  box-sizing: border-box;
  width: min(100%, 1280px);
  margin: auto;
  padding: clamp(44px, 8vw, 120px) clamp(24px, 6vw, 84px);
}
.hero-copy span, .overview :deep(.kicker) {
  font-size: 14px;
  font-weight: 650;
  letter-spacing: .12em;
}
.overview :deep(.kicker) {
  color: var(--el-color-primary);
}
h1 {
  margin: 22px 0;
  font-size: clamp(50px, 7vw, 110px);
  line-height: 1.04;
}
.overview :deep(section h2), footer h2 {
  margin: 16px 0;
  font-size: clamp(30px, 4.5vw, 60px);
  line-height: 1.18;
  text-wrap: balance;
}
.overview :deep(:where(p:not(.ticket-message p))) {
  line-height: 1.8;
  font-size: clamp(16px, 1.45vw, 20px);
  color: var(--el-text-color-regular);
  margin: 0 0 24px;
}
.hero .hero-copy p {
  color: white;
  max-width: 27em;
}
footer {
  text-align: center;
  background: var(--el-fill-color-light);
  padding: clamp(48px, 7vw, 96px) 20px;
}
.release {
  max-width: 760px;
  margin: 40px auto 0;
  padding: clamp(18px, 4vw, 36px);
  border-radius: 12px;
  background: var(--el-bg-color);
  text-align: left;
  line-height: 1.8;
}
</style>


