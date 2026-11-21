<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLedgerStore } from '@/stores/useLedger'
import { addMonths, shortMonthLabel } from '@/services/dates'
import { categoryTotals, percent, summarize, trend, type MonthTotal } from '@/services/stats'
import { transactionsSince } from '@/repositories/transactions'
import { formatCents } from '@/services/money'
import MonthSwitcher from '@/components/MonthSwitcher.vue'
import ChartDonut from '@/components/ChartDonut.vue'
import ChartBars from '@/components/ChartBars.vue'
import EmptyState from '@/components/EmptyState.vue'

const store = useLedgerStore()

const donutKind = ref<'expense' | 'income'>('expense')
const trendData = ref<MonthTotal[]>([])

const currency = computed(() => store.settings.currency)
const summary = computed(() => summarize(store.transactions))

const donut = computed(() => {
  const totals = categoryTotals(store.transactions, donutKind.value)
  const total = totals.reduce((sum, item) => sum + item.amountCents, 0)
  const top = totals.slice(0, 6)
  const rest = totals.slice(6).reduce((sum, item) => sum + item.amountCents, 0)

  const items = top.map((item) => {
    const category = store.categoryById(item.categoryId)
    return {
      label: category?.name ?? '未分类',
      color: category?.color ?? '#94a3b8',
      value: item.amountCents,
      share: percent(item.amountCents, total)
    }
  })
  if (rest > 0) {
    items.push({ label: '其他分类', color: '#8a8478', value: rest, share: percent(rest, total) })
  }
  return { items, total }
})

const trendMonths = computed(() =>
  Array.from({ length: 6 }, (_, index) => addMonths(store.month, index - 5))
)

const trendBars = computed(() =>
  trendData.value.map((item) => ({
    label: shortMonthLabel(item.month),
    income: item.income,
    expense: item.expense
  }))
)

async function refreshTrend(): Promise<void> {
  const months = trendMonths.value
  const transactions = await transactionsSince(months)
  trendData.value = trend(transactions, months)
}

watch([() => store.month, () => store.transactions], refreshTrend, { immediate: true })
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

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">分类占比</h2>
        <div class="seg seg--small">
          <button
            class="seg__item"
            :class="{ 'is-active': donutKind === 'expense' }"
            @click="donutKind = 'expense'"
          >
            支出
          </button>
          <button
            class="seg__item"
            :class="{ 'is-active': donutKind === 'income' }"
            @click="donutKind = 'income'"
          >
            收入
          </button>
        </div>
      </div>

      <template v-if="donut.items.length">
        <ChartDonut :items="donut.items" :currency="currency" />
        <ul class="legend">
          <li v-for="item in donut.items" :key="item.label" class="legend__item">
            <span class="legend__dot" :style="{ background: item.color }" />
            <span class="legend__label">{{ item.label }}</span>
            <span class="legend__share">{{ item.share }}%</span>
            <span class="legend__value">{{ currency }}{{ formatCents(item.value) }}</span>
          </li>
        </ul>
      </template>
      <EmptyState
        v-else
        icon="chart"
        :title="donutKind === 'expense' ? '本月还没有支出' : '本月还没有收入'"
        text="记一笔之后这里会出现分类占比"
      />
    </section>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">近 6 个月趋势</h2>
        <div class="bars-legend">
          <span class="bars-legend__item"><i class="dot dot--income" />收入</span>
          <span class="bars-legend__item"><i class="dot dot--expense" />支出</span>
        </div>
      </div>
      <ChartBars :data="trendBars" :currency="currency" />
    </section>
  </div>
</template>
