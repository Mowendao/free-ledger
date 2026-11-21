<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney } from '@/services/money'

const props = defineProps<{
  data: Array<{ label: string; income: number; expense: number }>
  currency: string
}>()

const max = computed(() => {
  const values = props.data.flatMap((item) => [item.income, item.expense])
  return Math.max(1, ...values)
})

function height(value: number): string {
  if (value <= 0) return '0%'
  return `${Math.max(3, (value / max.value) * 100)}%`
}
</script>

<template>
  <div class="bars">
    <div v-for="item in data" :key="item.label" class="bars__group">
      <div class="bars__cols">
        <div
          class="bars__bar bars__bar--income"
          :style="{ height: height(item.income) }"
          :title="`收入 ${formatMoney(item.income, currency)}`"
        />
        <div
          class="bars__bar bars__bar--expense"
          :style="{ height: height(item.expense) }"
          :title="`支出 ${formatMoney(item.expense, currency)}`"
        />
      </div>
      <span class="bars__label">{{ item.label }}</span>
    </div>
  </div>
</template>
