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
import { entries } from '@/utils/updateLog.js'
import '@/assets/styles/update-log.css'

const visible = defineModel({ type: Boolean, default: false })
</script>
