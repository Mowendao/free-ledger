<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Transaction } from '@/db/schema'
import { useLedgerStore } from '@/stores/useLedger'
import {
  emptyTrash,
  listDeletedTransactions,
  purgeTransaction,
  restoreTransaction
} from '@/repositories/transactions'
import { formatCents } from '@/services/money'
import { toast } from '@/services/toast'
import { confirmDialog } from '@/services/confirm'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'

const store = useLedgerStore()

const items = ref<Transaction[]>([])
const loading = ref(false)

const currency = computed(() => store.settings.currency)

async function load(): Promise<void> {
  loading.value = true
  try {
    items.value = await listDeletedTransactions()
  } finally {
    loading.value = false
  }
}

onMounted(load)

function titleOf(transaction: Transaction): string {
  if (transaction.kind === 'transfer') return '转账'
  return store.categoryById(transaction.categoryId)?.name ?? '未分类'
}

function iconOf(transaction: Transaction): string {
  if (transaction.kind === 'transfer') return 'transfer'
  return store.categoryById(transaction.categoryId)?.icon ?? 'other'
}

function colorOf(transaction: Transaction): string {
  if (transaction.kind === 'transfer') return '#6366f1'
  return store.categoryById(transaction.categoryId)?.color ?? '#8a8478'
}

function accountNameOf(transaction: Transaction): string {
  return store.accountById(transaction.accountId)?.name ?? '未知账户'
}

function deletedLabel(timestamp?: number | null): string {
  if (!timestamp) return '未知时间'
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`
}

async function restore(transaction: Transaction): Promise<void> {
  await restoreTransaction(transaction.id)
  await store.reloadAll()
  await load()
  toast('已恢复到账本')
}

async function purge(transaction: Transaction): Promise<void> {
  const ok = await confirmDialog({
    title: '彻底删除这笔记录？',
    message: '彻底删除后无法恢复。',
    confirmText: '彻底删除',
    danger: true
  })
  if (!ok) return
  await purgeTransaction(transaction.id)
  await load()
  toast('已彻底删除')
}

async function emptyAll(): Promise<void> {
  if (!items.value.length) return
  const ok = await confirmDialog({
    title: '清空回收站？',
    message: `将永久删除 ${items.value.length} 条记录，无法恢复。`,
    confirmText: '清空',
    danger: true
  })
  if (!ok) return
  const count = await emptyTrash()
  await load()
  toast(`已清空 ${count} 条记录`)
}
</script>

<template>
  <div class="page">
    <PageHeader title="回收站">
      <template #right>
        <span class="trash-count">{{ items.length }} 条</span>
      </template>
    </PageHeader>

    <p class="hint">删除的记录保留 30 天，可恢复或彻底删除；过期后自动清理。</p>

    <div v-if="items.length" class="list">
      <div v-for="transaction in items" :key="transaction.id" class="trash-row">
        <span
          class="bubble"
          :style="{ background: `${colorOf(transaction)}1f`, color: colorOf(transaction) }"
        >
          <AppIcon :name="iconOf(transaction)" :size="18" />
        </span>

        <span class="trash-row__main">
          <span class="trash-row__top">
            <span class="trash-row__title">{{ titleOf(transaction) }}</span>
            <span class="trash-row__amount">
              {{ transaction.kind === 'expense' ? '−' : transaction.kind === 'income' ? '+' : ''
              }}{{ currency }}{{ formatCents(transaction.amountCents) }}
            </span>
          </span>
          <span class="trash-row__sub">
            {{ accountNameOf(transaction) }} · 原日期 {{ transaction.date }}
          </span>
          <span class="trash-row__sub">删除于 {{ deletedLabel(transaction.deletedAt) }}</span>
        </span>

        <span class="trash-row__actions">
          <button class="btn btn--sm" @click="restore(transaction)">恢复</button>
          <button class="icon-btn" aria-label="彻底删除" @click="purge(transaction)">
            <AppIcon name="trash" :size="15" />
          </button>
        </span>
      </div>
    </div>

    <EmptyState
      v-else-if="!loading"
      icon="trash"
      title="回收站是空的"
      text="删除的记录会在这里保留 30 天"
    />

    <button
      v-if="items.length"
      class="btn btn--danger btn--block trash-empty"
      @click="emptyAll"
    >
      清空回收站
    </button>
  </div>
</template>
