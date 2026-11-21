<script setup lang="ts">
import { computed } from 'vue'
import { addMonths, currentMonth, monthLabel } from '@/services/dates'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ month: string }>()
const emit = defineEmits<{ 'update:month': [value: string] }>()

const label = computed(() => monthLabel(props.month))
const isCurrent = computed(() => props.month === currentMonth())

function shift(delta: number): void {
  emit('update:month', addMonths(props.month, delta))
}

function onPick(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  if (value) emit('update:month', value)
}
</script>

<template>
  <div class="month-switcher">
    <button class="month-switcher__btn" aria-label="上一月" @click="shift(-1)">
      <AppIcon name="chevron-left" :size="18" />
    </button>
    <label class="month-switcher__label">
      <span>{{ label }}</span>
      <AppIcon name="calendar" :size="15" />
      <input
        class="month-switcher__input"
        type="month"
        :value="month"
        aria-label="选择月份"
        @change="onPick"
      />
    </label>
    <button class="month-switcher__btn" aria-label="下一月" @click="shift(1)">
      <AppIcon name="chevron-right" :size="18" />
    </button>
    <button v-if="!isCurrent" class="month-switcher__today" @click="emit('update:month', currentMonth())">
      本月
    </button>
  </div>
</template>
