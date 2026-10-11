<script setup>
import { RouterLink } from 'vue-router'
import StationLink from '@/components/StationLink.vue'
import { stationTrainLocation } from '@/utils/stationNavigation.js'
import { displayTrainCode } from '@/utils/trainDisplay.js'

defineProps({
  row: { type: Object, required: true },
  fields: { type: Array, required: true },
  source: { type: String, required: true },
  date: { type: String, required: true },
  current: { type: Boolean, default: false },
  inStation: { type: Boolean, default: false },
})
</script>

<template>
  <article class="mobile-train" :class="{ 'is-current': current }">
    <div class="mobile-train-heading">
      <RouterLink :to="stationTrainLocation(row, source, date)" class="train-link">
        {{ displayTrainCode(row.train) }}
      </RouterLink>
      <span v-if="current" class="current-badge">
        {{ inStation ? '停在站内' : row.highlightLabel }}
      </span>
    </div>
    <dl class="mobile-train-fields">
      <div v-for="field in fields" :key="field.key" class="mobile-train-field">
        <dt>{{ field.title }}</dt>
        <dd>
          <StationLink
            v-if="field.key === 'from' || field.key === 'to'"
            :name="row[field.key]"
          />
          <span
            v-else
            :class="{ 'time-value': ['arrivalLabel', 'departureLabel'].includes(field.key) }"
          >
            {{ row[field.key] || '—' }}
          </span>
        </dd>
      </div>
    </dl>
  </article>
</template>

<style scoped>
.mobile-train {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 12px 14px;
  white-space: normal;
  overflow-wrap: anywhere;
}
.mobile-train-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
}
.train-link {
  min-width: 0;
  color: var(--el-color-primary);
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
}
.train-link:hover {
  text-decoration: underline;
}
.current-badge {
  flex-shrink: 0;
  color: var(--board-highlight-color);
  font-size: 12px;
  font-weight: 600;
}
.mobile-train-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 8px 0 0;
  font-variant-numeric: tabular-nums;
}
.mobile-train-field {
  min-width: 0;
}
dt {
  margin-bottom: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 16px;
}
dd {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 20px;
}
.is-current .time-value {
  color: var(--board-highlight-color);
  font-weight: 600;
}
</style>
