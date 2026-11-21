<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Category } from '@/db/schema'
import { useLedgerStore } from '@/stores/useLedger'
import { setBudget } from '@/repositories/budgets'
import { formatCents, parseCents, toAmountInput } from '@/services/money'
import { toast } from '@/services/toast'
import PageHeader from '@/components/PageHeader.vue'
import MonthSwitcher from '@/components/MonthSwitcher.vue'
import AppIcon from '@/components/AppIcon.vue'
import SheetModal from '@/components/SheetModal.vue'
import AmountKeypad from '@/components/AmountKeypad.vue'

const store = useLedgerStore()

const currency = computed(() => store.settings.currency)
const totalBudget = computed(() => store.totalBudget)
const monthExpense = computed(() => store.summary.expense)
const totalPercent = computed(() =>
  totalBudget.value > 0 ? Math.min(100, Math.round((monthExpense.value / totalBudget.value) * 100)) : 0
)

const categoryRows = computed(() =>
  store.expenseCategories.map((category) => {
    const spent = store.transactions
      .filter((tx) => tx.kind === 'expense' && tx.categoryId === category.id)
      .reduce((sum, tx) => sum + tx.amountCents, 0)
    const budget = store.budgets.find((item) => item.categoryId === category.id)?.amountCents ?? 0
    return {
      category,
      spent,
      budget,
      percent: budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0
    }
  })
)

const sheetOpen = ref(false)
const sheetTitle = ref('设置预算')
const sheetCategoryId = ref<string | null>(null)
const sheetAmount = ref('0')

function openTotal(): void {
  sheetCategoryId.value = null
  sheetTitle.value = '设置月度总预算'
  sheetAmount.value = toAmountInput(totalBudget.value)
  sheetOpen.value = true
}

function openCategory(category: Category): void {
  const budget = store.budgets.find((item) => item.categoryId === category.id)?.amountCents ?? 0
  sheetCategoryId.value = category.id
  sheetTitle.value = `设置「${category.name}」预算`
  sheetAmount.value = toAmountInput(budget)
  sheetOpen.value = true
}

async function saveBudget(): Promise<void> {
  const cents = parseCents(sheetAmount.value)
  await setBudget(store.month, sheetCategoryId.value, cents)
  await store.reloadMonth()
  sheetOpen.value = false
  toast(cents > 0 ? '预算已保存' : '预算已清除')
}
</script>

<template>
  <div class="page">
    <PageHeader title="月度预算" />
    <MonthSwitcher :month="store.month" @update:month="store.setMonth" />

    <button class="budget-total" @click="openTotal">
      <div class="budget-total__head">
        <span class="budget-total__label">本月总预算</span>
        <AppIcon name="edit" :size="16" class="muted" />
      </div>
      <div v-if="totalBudget > 0" class="budget-total__body">
        <span class="budget-total__value">{{ currency }}{{ formatCents(totalBudget) }}</span>
        <span class="budget-total__remain">
          已花 {{ currency }}{{ formatCents(monthExpense) }} ·
          {{ totalBudget - monthExpense >= 0 ? '剩余' : '超支' }}
          {{ currency }}{{ formatCents(Math.abs(totalBudget - monthExpense)) }}
        </span>
        <div class="progress">
          <div
            class="progress__bar"
            :class="{ 'is-over': monthExpense > totalBudget }"
            :style="{ width: `${totalPercent}%` }"
          />
        </div>
      </div>
      <div v-else class="budget-total__empty">点击设置本月总预算</div>
    </button>

    <p class="section-title">分类预算</p>
    <div class="list">
      <button
        v-for="row in categoryRows"
        :key="row.category.id"
        class="row budget-row"
        @click="openCategory(row.category)"
      >
        <span
          class="bubble"
          :style="{ background: `${row.category.color}1f`, color: row.category.color }"
        >
          <AppIcon :name="row.category.icon" :size="18" />
        </span>
        <span class="row__main">
          <span class="row__title">{{ row.category.name }}</span>
          <span class="row__sub">
            {{ row.budget > 0
              ? `已花 ${currency}${formatCents(row.spent)} / 预算 ${currency}${formatCents(row.budget)}`
              : `已花 ${currency}${formatCents(row.spent)} · 未设预算` }}
          </span>
          <span v-if="row.budget > 0" class="progress progress--inline">
            <span
              class="progress__bar"
              :class="{ 'is-over': row.spent > row.budget }"
              :style="{ width: `${row.percent}%` }"
            />
          </span>
        </span>
        <span v-if="row.budget > 0" class="row__amount">
          {{ row.percent }}%
        </span>
        <AppIcon v-else name="plus" :size="18" class="muted" />
      </button>
    </div>

    <p class="hint">预算只保存在本机，可随时修改或清除（输入 0 即清除）。</p>
  </div>

  <SheetModal :open="sheetOpen" :title="sheetTitle" @close="sheetOpen = false">
    <div class="budget-sheet">
      <div class="amount-display">
        <span class="amount-display__currency">{{ currency }}</span>
        <span class="amount-display__value">{{ sheetAmount }}</span>
      </div>
      <AmountKeypad v-model="sheetAmount" save-label="保存预算" @save="saveBudget" />
    </div>
  </SheetModal>
</template>
