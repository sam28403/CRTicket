<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { isGithubPagesBuild } from '@/config/deploy.js'
import { isGithubPagesRoute } from '@/router/githubPagesAccess.js'

const props = defineProps({ to: { type: String, required: true } })
const router = useRouter()
const blocked = computed(() => isGithubPagesBuild && !isGithubPagesRoute(props.to))
const message = '演示版不支持此功能，如需使用请移步正式版/Android版。'
</script>

<template>
  <el-tooltip :content="message" :disabled="!blocked" :trigger="['hover', 'focus', 'click']">
    <span class="route-button" :tabindex="blocked ? 0 : undefined">
      <el-button
        type="primary"
        :tag="blocked ? 'button' : 'a'"
        :disabled="blocked"
        :href="blocked ? undefined : router.resolve(to).href"
      >
        <slot />
      </el-button>
    </span>
  </el-tooltip>
</template>

<style scoped>
.route-button { display: inline-flex; max-width: 100%; }
.el-button.is-disabled { pointer-events: none; }
a.el-button,
a.el-button:hover,
a.el-button:focus-visible,
a.el-button:active { text-decoration: none; }
</style>
