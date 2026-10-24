<template>
  <el-dialog
    v-model="visible"
    title="更新内容"
    :z-index="3000"
    width="min(720px, calc(100vw - 32px))"
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    destroy-on-close
  >
    <div class="update-log">
      <article
        v-for="entry in entries"
        :key="entry.path"
        class="update-log-entry"
        v-html="entry.html"
      ></article>
      <el-empty v-if="!entries.length" description="暂无更新内容" />
    </div>
    <template #footer>
      <el-button type="primary" @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import '@/assets/styles/update-log.css'

const visible = defineModel({ type: Boolean, default: false })
const sources = import.meta.glob('../content/changelog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const entries = computed(() => Object.entries(sources)
  .sort(([left], [right]) => right.localeCompare(left))
  .map(([path, content]) => ({
    path,
    html: DOMPurify.sanitize(marked.parse(content, { async: false }), {
      USE_PROFILES: { html: true },
    }),
  })))
</script>
