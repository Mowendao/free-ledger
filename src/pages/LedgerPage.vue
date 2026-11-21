<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Transaction } from '@/db/schema'
import { useLedgerStore } from '@/stores/useLedger'
import { listAllTransactions } from '@/repositories/transactions'
import { formatCents, parseCents } from '@/services/money'
import { dateLabel } from '@/services/dates'
import { summarize } from '@/services/stats'
import { filterTransactions } from '@/services/search'
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
const amountMin = ref('')
const amountMax = ref('')
const searchOpen = ref(false)
const filterOpen = ref(false)

const allTransactions = ref<Transaction[]>([])

const currency = computed(() => store.settings.currency)
const monthSummary = computed(() => summarize(store.transactions))

function toCents(value: string): number | null {
  if (!value.trim()) return null
  const cents = parseCents(value)
  return cents > 0 ? cents : null
}

const minCents = computed(() => toCents(amountMin.value))
const maxCents = computed(() => toCents(amountMax.value))

const searchActive = computed(
  () =>
    keyword.value.trim() !== '' || minCents.value !== null || maxCents.value !== null
)

const filtered = computed(() => {
  const source = searchActive.value ? allTransactions.value : store.transactions
  return filterTransactions(
    source,
    {
      keyword: searchActive.value ? keyword.value : '',
      minCents: searchActive.value ? minCents.value : null,
      maxCents: searchActive.value ? maxCents.value : null,
      kind: kindFilter.value,
      categoryId: categoryFilter.value,
      accountId: accountFilter.value
    },
    store.categories,
    store.accounts
  )
})

const resultSummary = computed(() => summarize(filtered.value))

const filterCount = computed(
  () =>
    (categoryFilter.value ? 1 : 0) +
    (accountFilter.value ? 1 : 0) +
    (minCents.value !== null || maxCents.value !== null ? 1 : 0)
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

async function loadAll(): Promise<void> {
  allTransactions.value = await listAllTransactions()
}

onMounted(loadAll)
watch(() => store.transactions, loadAll)

function toggleSearch(): void {
  searchOpen.value = !searchOpen.value
  if (!searchOpen.value) keyword.value = ''
}

function resetFilters(): void {
  categoryFilter.value = null
  accountFilter.value = ''
  amountMin.value = ''
  amountMax.value = ''
}

function openTx(transaction: Transaction): void {
  router.push(`/record/${transaction.id}`)
}
</script>

<template>
  <div class="page">
    <MonthSwitcher v-if="!searchActive" :month="store.month" @update:month="store.setMonth" />

    <section v-if="!searchActive" class="summary-card">
      <div class="summary-card__item">
        <span class="summary-card__label">收入</span>
        <span class="summary-card__value text-income">{{ currency }}{{ formatCents(monthSummary.income) }}</span>
      </div>
      <div class="summary-card__divider" />
      <div class="summary-card__item">
        <span class="summary-card__label">支出</span>
        <span class="summary-card__value text-expense">{{ currency }}{{ formatCents(monthSummary.expense) }}</span>
      </div>
      <div class="summary-card__divider" />
      <div class="summary-card__item">
        <span class="summary-card__label">结余</span>
        <span class="summary-card__value">{{ currency }}{{ formatCents(monthSummary.net) }}</span>
      </div>
    </section>

    <section v-else class="search-summary">
      <span class="search-summary__title">全时段</span>
      <span>{{ filtered.length }} 条</span>
      <span class="text-income">收 {{ currency }}{{ formatCents(resultSummary.income) }}</span>
      <span class="text-expense">支 {{ currency }}{{ formatCents(resultSummary.expense) }}</span>
      <button v-if="filterCount > 0" class="link search-summary__clear" @click="resetFilters">
        清除筛选
      </button>
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
      <input
        v-model="keyword"
        class="search-field__input"
        placeholder="搜索备注 / 分类 / 账户 / 金额"
        autofocus
      />
      <button v-if="keyword" class="search-field__clear" aria-label="清空" @click="keyword = ''">
        <AppIcon name="close" :size="14" />
      </button>
    </label>

    <div v-if="filterCount > 0 && !searchActive" class="filter-note">
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
      :title="searchActive ? '没有匹配的记录' : '本月还没有记录'"
      :text="searchActive ? '换个关键词或放宽金额区间试试' : '去「记账」页记下第一笔吧'"
    />
  </div>

  <SheetModal :open="filterOpen" title="筛选" @close="filterOpen = false">
    <div class="filter-sheet">
      <p class="section-title">金额区间（元）</p>
      <div class="amount-range">
        <input v-model="amountMin" class="input" inputmode="decimal" placeholder="最低" />
        <span class="amount-range__dash">—</span>
        <input v-model="amountMax" class="input" inputmode="decimal" placeholder="最高" />
      </div>

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
