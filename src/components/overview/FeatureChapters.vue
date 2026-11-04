<script setup>
import OverviewRouteButton from './OverviewRouteButton.vue'
import ArchivePreview from './ArchivePreview.vue'
import TrainPreview from './TrainPreview.vue'
import MonitorPreview from './MonitorPreview.vue'
import { vScrollReveal } from './scrollReveal.js'

const chapters = [
  {
    label: '行程档案', title: '走过的站，在地图上重逢。',
    detail: '登录后保存车票，随时修改或再次下载。换个角度看，以前的一张张车票，也能连成足迹地图，汇成自己的乘车次数和里程统计。',
    links: [['查看历史记录', '/history']],
  },
  {
    label: '车次与车站', title: '一趟车，沿途停在哪里？',
    detail: '输入车次，从始发站一路看到终到站。对照各站到发时间、停站时长和里程，再到线路图上看看列车经过哪里。',
    preview: 'train',
    links: [['查询车次', '/train'], ['浏览离线车次', '/list']],
  },
  {
    label: '余票监控', title: '留意想坐的那班车。',
    detail: '选好出发地和目的地，按出发时间、车次或席别缩小范围。开启定时监控，在同一页查看候选列车的余票变化。',
    preview: 'monitor',
    links: [['查询与监控余票', '/monitor']],
  },
]
</script>

<template>
  <section v-for="chapter in chapters" :key="chapter.label" class="chapter">
    <div v-scroll-reveal="!!chapter.preview" class="intro">
      <span class="kicker">{{ chapter.label }}</span>
      <h2>{{ chapter.title }}</h2>
      <p>{{ chapter.detail }}</p>
      <div class="links">
        <template v-for="[label, path] in chapter.links" :key="path">
          <OverviewRouteButton :to="path">
            {{ label }}
          </OverviewRouteButton>
        </template>
      </div>
    </div>
    <figure v-if="chapter.preview === 'train'" v-scroll-reveal>
      <TrainPreview />
    </figure>
    <figure v-else-if="chapter.preview === 'monitor'" v-scroll-reveal>
      <MonitorPreview />
    </figure>
    <ArchivePreview v-else />
  </section>
  <section class="pair">
    <article v-scroll-reveal>
      <span class="kicker">车站大屏</span>
      <h2>站在一站，看当天到发。</h2>
      <p>切换到达和出发大屏，查找途经本站的列车，再打开车站地图查看位置。</p>
      <OverviewRouteButton to="/station">
        打开车站大屏
      </OverviewRouteButton>
    </article>
    <article v-scroll-reveal>
      <span class="kicker">普速票价</span>
      <h2>算一算，这段路多少钱。</h2>
      <p>填入普速车次、空调类型和计价里程，比较不同席别的估算票价，也可以直接查阅票价表。</p>
      <div class="links">
        <OverviewRouteButton to="/price">计算票价</OverviewRouteButton>
        <OverviewRouteButton to="/price/list">查看票价表</OverviewRouteButton>
      </div>
    </article>
  </section>
</template>

<style scoped>
.chapter, .pair {
  max-width: 1140px;
  margin: auto;
  padding: clamp(52px, 8vw, 104px) clamp(20px, 5vw, 64px);
}
.chapter + .chapter {
  border-top: 1px solid var(--el-border-color-lighter);
}
.intro {
  min-width: 0;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}
.links .el-button + .el-button {
  margin-left: 0;
}
a.el-button,
a.el-button:hover,
a.el-button:focus-visible,
a.el-button:active {
  text-decoration: none;
}
figure {
  margin: 32px 0 0;
  padding: clamp(12px, 3.5vw, 46px);
  background: var(--el-fill-color-light);
  border-radius: 16px;
  text-align: center;
}
figure img {
  display: block;
  width: 100%;
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light);
}
.pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
  gap: 24px;
  padding-top: 0;
  padding-bottom: 0;
}
article {
  padding: clamp(24px, 4vw, 48px);
  background: var(--el-fill-color-light);
  border-radius: 16px;
}
article h2 {
  font-size: clamp(26px, 3vw, 38px);
}
</style>

