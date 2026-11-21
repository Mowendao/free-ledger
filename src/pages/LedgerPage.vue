<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Transaction } from '@/db/schema'
import { useLedgerStore } from '@/stores/useLedger'
import { formatCents } from '@/services/money'
import { dateLabel } from '@/services/dates'
import { summarize } from '@/services/stats'
import { accountIcon } from '@/services/accountMeta'
import AppIcon from '@/components/AppIcon.vue'
import MonthSwitcher from '@/components/MonthSwitcher.vue'
import TxRow from '@/components/TxRow.vue'
import EmptyState from '@/components/EmptyState.vue'
import SheetModal from '@/components/SheetModal.vue'

const store = useLedgerStore()
const router = useRouter()

const kindFilter = ref<'all' | 'expense' | 'income'>('all')
const categoryFilter = ref<string | null>(null)
const accountFilter = ref('')
const keyword = ref('')
const searchOpen = ref(false)
const filterOpen = ref(false)

const currency = computed(() => store.settings.currency)
const summary = computed(() => summarize(store.transactions))

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return store.transactions.filter((tx) => {
    if (kindFilter.value !== 'all' && tx.kind !== kindFilter.value) return false
    if (categoryFilter.value && tx.categoryId !== categoryFilter.value) return false
    if (accountFilter.value && tx.accountId !== accountFilter.value) return false
    if (kw && !tx.note.toLowerCase().includes(kw)) return false
    return true
  })
})

const filterCount = computed(
  () => (categoryFilter.value ? 1 : 0) + (accountFilter.value ? 1 : 0)
)

interface DayGroup {
  date: string
  items: Transaction[]
  expense: number
  income: number
}

const groups = computed<DayGroup[]>(() => {
  const map = new Map<string, Transaction[]>()
  for (const tx of filtered.value) {
    const list = map.get(tx.date)
    if (list) list.push(tx)
    else map.set(tx.date, [tx])
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => {
      const sorted = items.slice().sort((a, b) => b.createdAt - a.createdAt)
      return {
        date,
        items: sorted,
        expense: sorted
          .filter((item) => item.kind === 'expense')
          .reduce((sum, item) => sum + item.amountCents, 0),
        income: sorted
          .filter((item) => item.kind === 'income')
          .reduce((sum, item) => sum + item.amountCents, 0)
      }
    })
})

function toggleSearch(): void {
  searchOpen.value = !searchOpen.value
  if (!searchOpen.value) keyword.value = ''
}

function resetFilters(): void {
  categoryFilter.value = null
  accountFilter.value = ''
}

function openTx(transaction: Transaction): void {
  router.push(`/record/${transaction.id}`)
}
</script>

<template>
  <div class="page">
    <MonthSwitcher :month="store.month" @update:month="store.setMonth" />

    <section class="summary-card">
      <div class="summary-card__item">
        <span class="summary-card__label">收入</span>
        <span class="summary-card__value text-income">{{ currency }}{{ formatCents(summary.income) }}</span>
      </div>
      <div class="summary-card__divider" />
      <div class="summary-card__item">
        <span class="summary-card__label">支出</span>
        <span class="summary-card__value text-expense">{{ currency }}{{ formatCents(summary.expense) }}</span>
      </div>
      <div class="summary-card__divider" />
      <div class="summary-card__item">
        <span class="summary-card__label">结余</span>
        <span class="summary-card__value">{{ currency }}{{ formatCents(summary.net) }}</span>
      </div>
    </section>

    <div class="toolbar">
      <div class="chip-group">
        <button class="chip" :class="{ 'is-active': kindFilter === 'all' }" @click="kindFilter = 'all'">全部</button>
        <button class="chip" :class="{ 'is-active': kindFilter === 'expense' }" @click="kindFilter = 'expense'">支出</button>
        <button class="chip" :class="{ 'is-active': kindFilter === 'income' }" @click="kindFilter = 'income'">收入</button>
      </div>
      <div class="toolbar__actions">
        <button
          class="icon-btn"
          :class="{ 'is-active': filterCount > 0 }"
          aria-label="筛选"
          @click="filterOpen = true"
        >
          <AppIcon name="settings" :size="18" />
        </button>
        <button
          class="icon-btn"
          :class="{ 'is-active': searchOpen }"
          aria-label="搜索"
          @click="toggleSearch"
        >
          <AppIcon name="search" :size="18" />
        </button>
      </div>
    </div>

    <label v-if="searchOpen" class="search-field">
      <AppIcon name="search" :size="16" />
      <input v-model="keyword" class="search-field__input" placeholder="搜索本月备注" autofocus />
      <button v-if="keyword" class="search-field__clear" aria-label="清空" @click="keyword = ''">
        <AppIcon name="close" :size="14" />
      </button>
    </label>

    <div v-if="filterCount > 0" class="filter-note">
      <span>已筛选 {{ filtered.length }} 条</span>
      <button class="link" @click="resetFilters">清除筛选</button>
    </div>

    <section v-for="group in groups" :key="group.date" class="day-group">
      <header class="day-group__head">
        <span>{{ dateLabel(group.date) }}</span>
        <span class="day-group__totals">
          <span v-if="group.income > 0" class="text-income">收 {{ formatCents(group.income) }}</span>
          <span v-if="group.expense > 0" class="text-expense">支 {{ formatCents(group.expense) }}</span>
        </span>
      </header>
      <div class="list">
        <TxRow
          v-for="tx in group.items"
          :key="tx.id"
          :tx="tx"
          :category="store.categoryById(tx.categoryId)"
          :account-name="store.accountById(tx.accountId)?.name ?? '未知账户'"
          :to-account-name="store.accountById(tx.toAccountId)?.name"
          :currency="currency"
          @click="openTx(tx)"
        />
      </div>
    </section>

    <EmptyState
      v-if="groups.length === 0"
      icon="list"
      title="本月还没有记录"
      text="去「记账」页记下第一笔吧"
    />
  </div>

  <SheetModal :open="filterOpen" title="筛选" @close="filterOpen = false">
    <div class="filter-sheet">
      <p class="section-title">分类</p>
      <div class="filter-grid">
        <button
          class="chip"
          :class="{ 'is-active': !categoryFilter }"
          @click="categoryFilter = null"
        >
          全部分类
        </button>
        <button
          v-for="category in store.categories"
          :key="category.id"
          class="chip"
          :class="{ 'is-active': categoryFilter === category.id }"
          @click="categoryFilter = category.id"
        >
          <AppIcon :name="category.icon" :size="14" />
          {{ category.name }}
        </button>
      </div>

      <p class="section-title">账户</p>
      <div class="filter-grid">
        <button class="chip" :class="{ 'is-active': !accountFilter }" @click="accountFilter = ''">
          全部账户
        </button>
        <button
          v-for="account in store.accounts"
          :key="account.id"
          class="chip"
          :class="{ 'is-active': accountFilter === account.id }"
          @click="accountFilter = account.id"
        >
          <AppIcon :name="accountIcon(account.type)" :size="14" />
          {{ account.name }}
        </button>
      </div>

      <button class="btn btn--primary btn--block filter-sheet__done" @click="filterOpen = false">
        完成
      </button>
    </div>
  </SheetModal>
</template>
