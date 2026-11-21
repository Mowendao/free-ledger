<script setup lang="ts">
import { computed } from 'vue'
import { formatCents } from '@/services/money'

const props = defineProps<{
  items: Array<{ label: string; color: string; value: number }>
  currency?: string
}>()

const R = 54
const C = 2 * Math.PI * R

const currency = computed(() => props.currency ?? '¥')
const total = computed(() => props.items.reduce((sum, item) => sum + item.value, 0))

const segments = computed(() => {
  let offset = 0
  return props.items.map((item) => {
    const length = total.value > 0 ? (item.value / total.value) * C : 0
    const segment = {
      ...item,
      dasharray: `${length} ${C - length}`,
      dashoffset: -offset
    }
    offset += length
    return segment
  })
})
</script>

<template>
  <div class="donut">
    <svg class="donut__svg" viewBox="0 0 140 140" role="img" aria-label="分类占比">
      <circle cx="70" cy="70" :r="R" fill="none" stroke="var(--c-surface-2)" stroke-width="18" />
      <circle
        v-for="(segment, index) in segments"
        :key="index"
        cx="70"
        cy="70"
        :r="R"
        fill="none"
        :stroke="segment.color"
        stroke-width="18"
        :stroke-dasharray="segment.dasharray"
        :stroke-dashoffset="segment.dashoffset"
        transform="rotate(-90 70 70)"
      />
    </svg>
    <div class="donut__center">
      <span class="donut__label">合计</span>
      <span class="donut__value">{{ currency }}{{ formatCents(total) }}</span>
    </div>
  </div>
</template>
