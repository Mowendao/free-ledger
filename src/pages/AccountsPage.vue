<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { Account, AccountType } from '@/db/schema'
import { useLedgerStore } from '@/stores/useLedger'
import {
  createAccount,
  deleteAccount,
  setAccountArchived,
  updateAccount
} from '@/repositories/accounts'
import { parseCents, toAmountInput } from '@/services/money'
import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPE_OPTIONS, accountIcon } from '@/services/accountMeta'
import { toast } from '@/services/toast'
import { confirmDialog } from '@/services/confirm'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import SheetModal from '@/components/SheetModal.vue'
import EmptyState from '@/components/EmptyState.vue'

const store = useLedgerStore()

const sheetOpen = ref(false)
const editingId = ref<string | null>(null)
const archivedOpen = ref(false)
const saving = ref(false)

const form = reactive({
  name: '',
  type: 'cash' as AccountType,
  initial: '0'
})

const currency = computed(() => store.settings.currency)
const activeAccounts = computed(() => store.accounts.filter((account) => !account.archived))
const archivedAccounts = computed(() => store.accounts.filter((account) => account.archived))
const editingAccount = computed(() => store.accounts.find((account) => account.id === editingId.value))
const totalAssets = computed(() =>
  activeAccounts.value.reduce((sum, account) => sum + (store.balances[account.id] ?? 0), 0)
)

function openAdd(): void {
  editingId.value = null
  form.name = ''
  form.type = 'cash'
  form.initial = '0'
  sheetOpen.value = true
}

function openEdit(account: Account): void {
  editingId.value = account.id
  form.name = account.name
  form.type = account.type
  form.initial = toAmountInput(account.initialBalanceCents)
  sheetOpen.value = true
}

async function save(): Promise<void> {
  if (saving.value) return
  if (!form.name.trim()) {
    toast('请输入账户名称', 'error')
    return
  }
  saving.value = true
  try {
    const initialBalanceCents = parseCents(form.initial)
    if (editingId.value) {
      await updateAccount(editingId.value, {
        name: form.name,
        type: form.type,
        initialBalanceCents
      })
      toast('账户已更新')
    } else {
      await createAccount({ name: form.name, type: form.type, initialBalanceCents })
      toast('账户已创建')
    }
    await store.reloadBasics()
    sheetOpen.value = false
  } catch (error) {
    toast(error instanceof Error ? error.message : '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

async function toggleArchive(account: Account): Promise<void> {
  await setAccountArchived(account.id, !account.archived)
  await store.reloadBasics()
  toast(account.archived ? '账户已恢复' : '账户已归档')
  if (account.archived) archivedOpen.value = false
}

async function remove(): Promise<void> {
  if (!editingId.value) return
  const ok = await confirmDialog({
    title: '删除账户？',
    message: '只有没有任何流水的账户才能删除；有流水的账户请改为归档。',
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
  const result = await deleteAccount(editingId.value)
  if (!result.ok) {
    toast(result.reason ?? '无法删除', 'error')
    return
  }
  await store.reloadBasics()
  sheetOpen.value = false
  toast('账户已删除')
}
</script>

<template>
  <div class="page">
    <PageHeader title="账户管理">
      <template #right>
        <button class="icon-btn" aria-label="新增账户" @click="openAdd">
          <AppIcon name="plus" :size="20" />
        </button>
      </template>
    </PageHeader>

    <section class="stat-card stat-card--wide">
      <span class="stat-card__label">账户总资产</span>
      <span class="stat-card__value">{{ currency }}{{ (totalAssets / 100).toFixed(2) }}</span>
      <span class="stat-card__hint">由期初余额与全部流水实时计算</span>
    </section>

    <div class="list">
      <button
        v-for="account in activeAccounts"
        :key="account.id"
        class="row"
        @click="openEdit(account)"
      >
        <span class="bubble bubble--soft"><AppIcon :name="accountIcon(account.type)" :size="18" /></span>
        <span class="row__main">
          <span class="row__title">{{ account.name }}</span>
          <span class="row__sub">{{ ACCOUNT_TYPE_LABEL[account.type] }} · 期初 {{ currency }}{{ (account.initialBalanceCents / 100).toFixed(2) }}</span>
        </span>
        <span class="row__amount">{{ currency }}{{ ((store.balances[account.id] ?? 0) / 100).toFixed(2) }}</span>
      </button>
    </div>

    <button
      v-if="archivedAccounts.length"
      class="archived-toggle"
      @click="archivedOpen = !archivedOpen"
    >
      <AppIcon :name="archivedOpen ? 'chevron-down' : 'chevron-right'" :size="16" />
      已归档账户（{{ archivedAccounts.length }}）
    </button>

    <div v-if="archivedOpen" class="list archived-list">
      <button
        v-for="account in archivedAccounts"
        :key="account.id"
        class="row"
        @click="openEdit(account)"
      >
        <span class="bubble bubble--soft"><AppIcon :name="accountIcon(account.type)" :size="18" /></span>
        <span class="row__main">
          <span class="row__title">{{ account.name }}</span>
          <span class="row__sub">已归档</span>
        </span>
        <span class="row__amount">{{ currency }}{{ ((store.balances[account.id] ?? 0) / 100).toFixed(2) }}</span>
      </button>
    </div>

    <EmptyState
      v-if="activeAccounts.length === 0"
      icon="wallet"
      title="还没有可用账户"
      text="点击右上角 + 新建一个账户"
    />

    <button class="btn btn--primary btn--block add-btn" @click="openAdd">
      <AppIcon name="plus" :size="18" />
      新建账户
    </button>
  </div>

  <SheetModal
    :open="sheetOpen"
    :title="editingId ? '编辑账户' : '新建账户'"
    @close="sheetOpen = false"
  >
    <div class="form">
      <label class="field">
        <span class="field__label">账户名称</span>
        <input v-model="form.name" class="input" maxlength="12" placeholder="例如：微信零钱" />
      </label>

      <div class="field">
        <span class="field__label">账户类型</span>
        <div class="chip-group">
          <button
            v-for="option in ACCOUNT_TYPE_OPTIONS"
            :key="option.value"
            class="chip"
            :class="{ 'is-active': form.type === option.value }"
            @click="form.type = option.value"
          >
            <AppIcon :name="accountIcon(option.value)" :size="14" />
            {{ option.label }}
          </button>
        </div>
      </div>

      <label class="field">
        <span class="field__label">期初余额（{{ currency }}）</span>
        <input v-model="form.initial" class="input" inputmode="decimal" placeholder="0.00" />
      </label>

      <div class="form__actions">
        <button v-if="editingId" class="btn btn--danger" @click="remove">删除</button>
        <button v-if="editingAccount" class="btn" @click="toggleArchive(editingAccount)">
          {{ editingAccount.archived ? '恢复' : '归档' }}
        </button>
        <button class="btn btn--primary form__grow" :disabled="saving" @click="save">保存</button>
      </div>
    </div>
  </SheetModal>
</template>
