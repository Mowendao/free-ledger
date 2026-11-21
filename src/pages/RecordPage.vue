<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Account, TxKind } from '@/db/schema'
import { useLedgerStore } from '@/stores/useLedger'
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  restoreTransaction,
  updateTransaction
} from '@/repositories/transactions'
import { parseCents, toAmountInput } from '@/services/money'
import { isValidDate, monthOf, todayISO } from '@/services/dates'
import { requestPersistentStorage } from '@/services/storage'
import { accountIcon } from '@/services/accountMeta'
import { toast } from '@/services/toast'
import { confirmDialog } from '@/services/confirm'
import { learnMerchantRule } from '@/repositories/settings'
import AppIcon from '@/components/AppIcon.vue'
import AmountKeypad from '@/components/AmountKeypad.vue'
import CategoryGrid from '@/components/CategoryGrid.vue'
import SheetModal from '@/components/SheetModal.vue'

const store = useLedgerStore()
const route = useRoute()
const router = useRouter()

const kind = ref<TxKind>('expense')
const amount = ref('0')
const categoryId = ref<string | null>(null)
const accountId = ref('')
const toAccountId = ref('')
const date = ref(todayISO())
const note = ref('')
const editingId = ref<string | null>(null)
const saving = ref(false)
const accountSheetOpen = ref(false)
const toAccountSheetOpen = ref(false)

const categories = computed(() =>
  kind.value === 'expense' ? store.expenseCategories : store.incomeCategories
)
const selectedAccount = computed(() => store.activeAccounts.find((item) => item.id === accountId.value))
const selectedTo = computed(() => store.activeAccounts.find((item) => item.id === toAccountId.value))
const amountCents = computed(() => parseCents(amount.value))
const currency = computed(() => store.settings.currency)

function ensureDefaults(): void {
  if (!store.activeAccounts.some((account) => account.id === accountId.value)) {
    accountId.value = store.activeAccounts[0]?.id ?? ''
  }
  if (!store.activeAccounts.some((account) => account.id === toAccountId.value)) {
    toAccountId.value =
      store.activeAccounts.find((account) => account.id !== accountId.value)?.id ??
      store.activeAccounts[0]?.id ??
      ''
  }
  if (!categories.value.some((category) => category.id === categoryId.value)) {
    categoryId.value = categories.value[0]?.id ?? null
  }
}

watch(kind, () => {
  if (kind.value === 'transfer') {
    categoryId.value = null
    return
  }
  if (!categories.value.some((category) => category.id === categoryId.value)) {
    categoryId.value = categories.value[0]?.id ?? null
  }
})

onMounted(async () => {
  ensureDefaults()
  const id = route.params.id
  if (!id) return

  const transaction = await getTransaction(String(id))
  if (!transaction) {
    toast('记录不存在或已被删除', 'error')
    router.replace('/ledger')
    return
  }
  editingId.value = transaction.id
  kind.value = transaction.kind
  amount.value = toAmountInput(transaction.amountCents)
  categoryId.value = transaction.categoryId
  accountId.value = transaction.accountId
  toAccountId.value = transaction.toAccountId ?? ''
  date.value = transaction.date
  note.value = transaction.note
})

function onDateChange(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  if (value) date.value = value
}

/** 记住「商户 → 分类」，下次导入微信账单可自动归类。 */
async function rememberMerchant(input: {
  kind: TxKind
  categoryId: string | null
  note: string
}): Promise<void> {
  if (input.kind === 'transfer' || !input.categoryId || !input.note.trim()) return
  await learnMerchantRule(input.note, input.categoryId)
}

async function save(): Promise<void> {
  if (saving.value) return
  if (!amountCents.value) {
    toast('请输入金额', 'error')
    return
  }
  if (kind.value !== 'transfer' && !categoryId.value) {
    toast('请选择分类', 'error')
    return
  }
  if (!accountId.value) {
    toast('请选择账户', 'error')
    return
  }
  if (kind.value === 'transfer') {
    if (!toAccountId.value) {
      toast('请选择转入账户', 'error')
      return
    }
    if (toAccountId.value === accountId.value) {
      toast('转出与转入账户不能相同', 'error')
      return
    }
  }
  if (!isValidDate(date.value)) {
    toast('日期格式不正确', 'error')
    return
  }

  saving.value = true
  try {
    const input = {
      kind: kind.value,
      amountCents: amountCents.value,
      categoryId: categoryId.value,
      accountId: accountId.value,
      toAccountId: toAccountId.value,
      date: date.value,
      note: note.value
    }
    if (editingId.value) {
      await updateTransaction(editingId.value, input)
      await rememberMerchant(input)
      await store.reloadAll()
      await store.setMonth(monthOf(date.value))
      toast('修改已保存')
      router.replace('/ledger')
      return
    }
    await createTransaction(input)
    await rememberMerchant(input)
    await store.reloadAll()
    void requestPersistentStorage()
    toast('已记一笔')
    amount.value = '0'
    note.value = ''
    date.value = todayISO()
  } catch (error) {
    toast(error instanceof Error ? error.message : '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

async function remove(): Promise<void> {
  if (!editingId.value) return
  const id = editingId.value
  const ok = await confirmDialog({
    title: '移入回收站？',
    message: '删除后可在「我的 → 回收站」恢复，保留 30 天。',
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
  await deleteTransaction(id)
  await store.reloadAll()
  toast('已移入回收站', 'info', {
    label: '撤销',
    onClick: async () => {
      await restoreTransaction(id)
      await store.reloadAll()
      toast('已恢复')
    }
  })
  router.replace('/ledger')
}

function pickAccount(account: Account): void {
  accountId.value = account.id
  accountSheetOpen.value = false
}
function pickToAccount(account: Account): void {
  toAccountId.value = account.id
  toAccountSheetOpen.value = false
}
</script>

<template>
  <div class="page record-page">
    <header class="record-head">
      <div class="seg record-head__seg">
        <button
          class="seg__item"
          :class="{ 'is-active': kind === 'expense' }"
          @click="kind = 'expense'"
        >
          支出
        </button>
        <button
          class="seg__item"
          :class="{ 'is-active': kind === 'income' }"
          @click="kind = 'income'"
        >
          收入
        </button>
        <button
          class="seg__item"
          :class="{ 'is-active': kind === 'transfer' }"
          @click="kind = 'transfer'"
        >
          转账
        </button>
      </div>
    </header>

    <section class="amount-card">
      <div class="amount-card__top">
        <span class="amount-card__label">
          {{ kind === 'expense' ? '支出金额' : kind === 'income' ? '收入金额' : '转账金额' }}
        </span>
        <button v-if="editingId" class="link-danger" @click="remove">删除</button>
      </div>
      <div class="amount-card__value">
        <span class="amount-card__currency">{{ currency }}</span>
        <span class="amount-card__number" :class="{ 'is-zero': amountCents === 0 }">{{ amount }}</span>
      </div>
      <span class="seal" aria-hidden="true">记</span>
    </section>

    <div class="account-row">
      <button class="account-chip" @click="accountSheetOpen = true">
        <AppIcon :name="selectedAccount ? accountIcon(selectedAccount.type) : 'wallet'" :size="16" />
        <span>{{ kind === 'transfer' ? '从 ' : '' }}{{ selectedAccount?.name ?? '选择账户' }}</span>
        <AppIcon name="chevron-down" :size="14" />
      </button>
      <template v-if="kind === 'transfer'">
        <AppIcon name="chevron-right" :size="16" class="muted" />
        <button class="account-chip" @click="toAccountSheetOpen = true">
          <AppIcon :name="selectedTo ? accountIcon(selectedTo.type) : 'wallet'" :size="16" />
          <span>到 {{ selectedTo?.name ?? '转入账户' }}</span>
          <AppIcon name="chevron-down" :size="14" />
        </button>
      </template>
      <label class="date-chip">
        <AppIcon name="calendar" :size="15" />
        <span>{{ date }}</span>
        <input class="date-chip__input" type="date" :value="date" @change="onDateChange" />
      </label>
    </div>

    <CategoryGrid v-if="kind !== 'transfer'" v-model="categoryId" :categories="categories" />

    <label class="note-field">
      <AppIcon name="edit" :size="16" />
      <input
        v-model="note"
        class="note-field__input"
        maxlength="50"
        placeholder="添加备注（可选）"
        enterkeyhint="done"
      />
    </label>

    <AmountKeypad
      v-model="amount"
      :save-label="editingId ? '保存修改' : '保存'"
      :disabled="saving"
      @save="save"
    />
  </div>

  <SheetModal :open="accountSheetOpen" title="选择账户" @close="accountSheetOpen = false">
    <div class="list">
      <button
        v-for="account in store.activeAccounts"
        :key="account.id"
        class="row"
        @click="pickAccount(account)"
      >
        <span class="bubble bubble--soft"><AppIcon :name="accountIcon(account.type)" :size="18" /></span>
        <span class="row__main">
          <span class="row__title">{{ account.name }}</span>
          <span class="row__sub">余额 {{ currency }}{{ ((store.balances[account.id] ?? 0) / 100).toFixed(2) }}</span>
        </span>
        <AppIcon v-if="account.id === accountId" name="check" :size="18" class="text-primary" />
      </button>
    </div>
  </SheetModal>

  <SheetModal :open="toAccountSheetOpen" title="选择转入账户" @close="toAccountSheetOpen = false">
    <div class="list">
      <button
        v-for="account in store.activeAccounts"
        :key="account.id"
        class="row"
        @click="pickToAccount(account)"
      >
        <span class="bubble bubble--soft"><AppIcon :name="accountIcon(account.type)" :size="18" /></span>
        <span class="row__main">
          <span class="row__title">{{ account.name }}</span>
          <span class="row__sub">余额 {{ currency }}{{ ((store.balances[account.id] ?? 0) / 100).toFixed(2) }}</span>
        </span>
        <AppIcon v-if="account.id === toAccountId" name="check" :size="18" class="text-primary" />
      </button>
    </div>
  </SheetModal>
</template>
