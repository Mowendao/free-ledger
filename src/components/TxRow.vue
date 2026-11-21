<script setup lang="ts">
import { computed } from 'vue'
import type { Category, Transaction } from '@/db/schema'
import { formatCents } from '@/services/money'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  tx: Transaction
  category?: Category
  accountName: string
  toAccountName?: string
  currency: string
}>()

const emit = defineEmits<{ click: [] }>()

const isTransfer = computed(() => props.tx.kind === 'transfer')
const title = computed(() => (isTransfer.value ? '转账' : props.category?.name ?? '未分类'))
const subtitle = computed(() => {
  if (isTransfer.value) return `${props.accountName} → ${props.toAccountName ?? '?'}`
  return props.tx.note || props.accountName
})
const color = computed(() => (isTransfer.value ? '#6366f1' : props.category?.color ?? '#94a3b8'))
const icon = computed(() => (isTransfer.value ? 'transfer' : props.category?.icon ?? 'other'))
const sign = computed(() =>
  props.tx.kind === 'expense' ? '−' : props.tx.kind === 'income' ? '+' : ''
)
</script>

<template>
  <button class="tx-row" @click="emit('click')">
    <span class="bubble" :style="{ background: `${color}1f`, color }">
      <AppIcon :name="icon" :size="19" />
    </span>
    <span class="tx-row__main">
      <span class="tx-row__title">{{ title }}</span>
      <span class="tx-row__sub">{{ subtitle }}</span>
    </span>
    <span class="tx-row__amount" :class="`tx-row__amount--${tx.kind}`">
      {{ sign }}{{ currency }}{{ formatCents(tx.amountCents) }}
    </span>
  </button>
</template>
