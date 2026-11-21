<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  MAX_BACKUP_BYTES,
  buildBackup,
  buildCsv,
  clearAllData,
  getDataStats,
  mergeWithBackup,
  parseBackup,
  replaceWithBackup,
  serializeBackup,
  type DataStats
} from '@/services/backup'
import { useLedgerStore } from '@/stores/useLedger'
import { confirmDialog } from '@/services/confirm'
import { toast } from '@/services/toast'
import {
  formatBytes,
  getStorageStatus,
  requestPersistentStorage,
  type StorageStatus
} from '@/services/storage'
import { markBackupNow } from '@/repositories/settings'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

const store = useLedgerStore()

const mode = ref<'merge' | 'replace'>('merge')
const importing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const stats = ref<DataStats>({
  transactions: 0,
  accounts: 0,
  categories: 0,
  budgets: 0,
  firstDate: null,
  lastDate: null
})
const storage = ref<StorageStatus | null>(null)
const requestingPersist = ref(false)

const storagePercent = computed(() => {
  if (!storage.value?.quota) return 0
  return Math.min(100, Math.round((storage.value.usage / storage.value.quota) * 1000) / 10)
})

const persistLabel = computed(() => {
  if (!storage.value) return '检测中'
  if (!storage.value.supported) return '浏览器不支持'
  return storage.value.persisted ? '已启用' : '未启用'
})

const lastBackupLabel = computed(() => {
  if (!store.settings.lastBackupAt) return '尚未导出备份'
  const date = new Date(store.settings.lastBackupAt)
  if (Number.isNaN(date.getTime())) return '尚未导出备份'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`
})

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
}

async function loadStats(): Promise<void> {
  stats.value = await getDataStats()
}

async function loadStorage(): Promise<void> {
  storage.value = await getStorageStatus()
}

onMounted(async () => {
  await Promise.all([loadStats(), loadStorage()])
})

async function enablePersistent(): Promise<void> {
  requestingPersist.value = true
  try {
    const granted = await requestPersistentStorage()
    await loadStorage()
    toast(
      granted ? '已启用持久化存储' : '浏览器未授予，请继续定期导出备份',
      granted ? 'success' : 'info'
    )
  } finally {
    requestingPersist.value = false
  }
}

async function exportJson(): Promise<void> {
  try {
    const backup = await buildBackup()
    download(`free-ledger-backup-${today()}.json`, serializeBackup(backup), 'application/json')
    await markBackupNow()
    await store.refreshSettings()
    toast('JSON 备份已导出')
  } catch (error) {
    toast(error instanceof Error ? error.message : '导出失败', 'error')
  }
}

async function exportCsv(): Promise<void> {
  try {
    const csv = await buildCsv()
    download(`free-ledger-records-${today()}.csv`, csv, 'text/csv;charset=utf-8')
    toast('CSV 已导出')
  } catch (error) {
    toast(error instanceof Error ? error.message : '导出失败', 'error')
  }
}

function triggerImport(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > MAX_BACKUP_BYTES) {
    toast('文件超过 10MB，已拒绝', 'error')
    return
  }

  let backup
  try {
    backup = parseBackup(await file.text())
  } catch (error) {
    toast(error instanceof Error ? error.message : '备份文件无效', 'error')
    return
  }

  const counts = `流水 ${backup.data.transactions.length} 笔、账户 ${backup.data.accounts.length} 个、分类 ${backup.data.categories.length} 个、预算 ${backup.data.budgets.length} 条`
  const exportedAt = backup.exportedAt
    ? `导出时间 ${new Date(backup.exportedAt).toLocaleString('zh-CN')}。`
    : ''

  const ok = await confirmDialog({
    title: mode.value === 'replace' ? '覆盖导入？' : '合并导入？',
    message:
      mode.value === 'replace'
        ? `${exportedAt}将清空当前 ${stats.value.transactions} 笔流水，恢复备份中的 ${counts}。覆盖前会自动导出当前数据。`
        : `${exportedAt}${counts}，按 id 去重合并。`,
    confirmText: '导入',
    danger: mode.value === 'replace'
  })
  if (!ok) return

  importing.value = true
  try {
    if (mode.value === 'replace') {
      const current = await buildBackup()
      download(
        `free-ledger-before-import-${today()}.json`,
        serializeBackup(current),
        'application/json'
      )
      toast('已自动导出当前数据备份', 'info')
    }

    const result =
      mode.value === 'replace' ? await replaceWithBackup(backup) : await mergeWithBackup(backup)
    await store.reloadAll()
    await store.refreshSettings()
    await Promise.all([loadStats(), loadStorage()])
    toast(`导入完成：新增 ${result.imported}，跳过 ${result.skipped}`)
  } catch (error) {
    toast(error instanceof Error ? error.message : '导入失败', 'error')
  } finally {
    importing.value = false
  }
}

async function clearData(): Promise<void> {
  const first = await confirmDialog({
    title: '清空全部数据？',
    message: '会删除所有流水、账户、分类与预算，并恢复默认账户和分类。建议先导出备份。',
    confirmText: '继续',
    danger: true
  })
  if (!first) return

  const second = await confirmDialog({
    title: '再次确认',
    message: '此操作不可恢复，确定要清空吗？',
    confirmText: '确认清空',
    danger: true
  })
  if (!second) return

  await clearAllData()
  await store.reloadAll()
  await store.refreshSettings()
  await Promise.all([loadStats(), loadStorage()])
  toast('数据已清空')
}
</script>

<template>
  <div class="page">
    <PageHeader title="数据备份与导出" />

    <section class="card">
      <h2 class="card-title">本机数据</h2>
      <div class="data-stats">
        <div class="data-stats__item">
          <span class="data-stats__value">{{ stats.transactions }}</span>
          <span class="data-stats__label">流水</span>
        </div>
        <div class="data-stats__item">
          <span class="data-stats__value">{{ stats.accounts }}</span>
          <span class="data-stats__label">账户</span>
        </div>
        <div class="data-stats__item">
          <span class="data-stats__value">{{ stats.categories }}</span>
          <span class="data-stats__label">分类</span>
        </div>
        <div class="data-stats__item">
          <span class="data-stats__value">{{ stats.budgets }}</span>
          <span class="data-stats__label">预算</span>
        </div>
      </div>
      <div class="storage">
        <div class="storage__row">
          <span>持久化存储</span>
          <span class="storage__badge" :class="{ 'is-on': storage?.persisted }">{{ persistLabel }}</span>
        </div>
        <div class="storage__row">
          <span>已用空间</span>
          <span>{{ formatBytes(storage?.usage ?? 0) }} / {{ formatBytes(storage?.quota ?? 0) }}</span>
        </div>
        <div class="progress">
          <div class="progress__bar" :style="{ width: `${storagePercent}%` }" />
        </div>
        <button
          v-if="storage?.supported && !storage.persisted"
          class="btn btn--block storage__btn"
          :disabled="requestingPersist"
          @click="enablePersistent"
        >
          {{ requestingPersist ? '申请中…' : '申请持久化存储' }}
        </button>
      </div>

      <p class="hint">
        持久化能降低浏览器清理数据的概率，但仍建议定期导出 JSON 备份。
      </p>

      <p class="hint">
        最近备份：{{ lastBackupLabel }}
        <template v-if="stats.firstDate">
          · 记录范围 {{ stats.firstDate }} ~ {{ stats.lastDate }}
        </template>
      </p>
    </section>

    <section class="card">
      <h2 class="card-title">导出备份</h2>
      <p class="paragraph">
        JSON 备份包含全部账目、账户、分类、预算与设置，可在任意设备导入恢复；CSV 便于用 Excel 查看。
      </p>
      <div class="button-row">
        <button class="btn btn--primary form__grow" @click="exportJson">
          <AppIcon name="download" :size="17" />
          导出 JSON
        </button>
        <button class="btn form__grow" @click="exportCsv">
          <AppIcon name="download" :size="17" />
          导出 CSV
        </button>
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">导入备份</h2>
      <div class="seg">
        <button class="seg__item" :class="{ 'is-active': mode === 'merge' }" @click="mode = 'merge'">
          合并导入
        </button>
        <button class="seg__item" :class="{ 'is-active': mode === 'replace' }" @click="mode = 'replace'">
          覆盖导入
        </button>
      </div>
      <p class="hint">
        {{ mode === 'merge'
          ? '保留现有数据，只补充备份中缺少的记录（按 id 去重）。'
          : '清空当前数据后完整恢复备份，适合换机迁移。' }}
      </p>
      <input
        ref="fileInput"
        class="hidden-input"
        type="file"
        accept="application/json,.json"
        @change="onFileChange"
      />
      <button class="btn btn--block" :disabled="importing" @click="triggerImport">
        <AppIcon name="upload" :size="17" />
        {{ importing ? '导入中…' : '选择备份文件' }}
      </button>
    </section>

    <section class="card card--danger">
      <h2 class="card-title text-danger">危险操作</h2>
      <p class="paragraph">清空本机全部数据并恢复默认账户与分类，操作不可恢复。</p>
      <button class="btn btn--danger btn--block" @click="clearData">
        <AppIcon name="trash" :size="17" />
        清空全部数据
      </button>
    </section>
  </div>
</template>
