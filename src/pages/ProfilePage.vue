<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLedgerStore } from '@/stores/useLedger'
import { formatCents } from '@/services/money'
import { toast } from '@/services/toast'
import { SKINS } from '@/services/skins'
import { countDeletedTransactions } from '@/repositories/transactions'
import type { SkinId } from '@/db/schema'
import AppIcon from '@/components/AppIcon.vue'
import { version } from '../../package.json'

const store = useLedgerStore()
const router = useRouter()

const appVersion = version
const currency = computed(() => store.settings.currency)
const deletedCount = ref(0)

onMounted(async () => {
  deletedCount.value = await countDeletedTransactions()
})

const themeOptions = [
  { value: 'light', label: '浅色', icon: 'sun' },
  { value: 'dark', label: '深色', icon: 'moon' },
  { value: 'system', label: '跟随系统', icon: 'settings' }
] as const

const currencyOptions = ['¥', '$', '€', '£', '₩', '₹']

const lastBackupLabel = computed(() => {
  if (!store.settings.lastBackupAt) return '尚未导出备份'
  const date = new Date(store.settings.lastBackupAt)
  if (Number.isNaN(date.getTime())) return '尚未导出备份'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')} 已备份`
})

const needBackup = computed(() => {
  if (store.transactions.length === 0) return false
  const time = Date.parse(store.settings.lastBackupAt)
  return !time || Date.now() - time > 7 * 24 * 60 * 60 * 1000
})

async function setTheme(value: 'light' | 'dark' | 'system'): Promise<void> {
  await store.saveSetting('theme', value)
}

async function setSkin(value: SkinId): Promise<void> {
  await store.saveSetting('skin', value)
  toast(`已切换到「${SKINS.find((skin) => skin.id === value)?.name ?? value}」`)
}

async function setCurrency(value: string): Promise<void> {
  await store.saveSetting('currency', value)
  toast('货币符号已更新')
}
</script>

<template>
  <div class="page">
    <section class="profile-hero">
      <div class="profile-hero__logo">账</div>
      <div class="profile-hero__main">
        <h1 class="profile-hero__name">Free Ledger</h1>
        <p class="profile-hero__tag">一纸账本，只属于你</p>
      </div>
      <span class="profile-hero__version">v{{ appVersion }}</span>
    </section>

    <section class="stat-cards">
      <div class="stat-card">
        <span class="stat-card__label">总资产</span>
        <span class="stat-card__value">{{ currency }}{{ formatCents(store.totalAssets) }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-card__label">本月支出</span>
        <span class="stat-card__value text-expense">{{ currency }}{{ formatCents(store.summary.expense) }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-card__label">本月记录</span>
        <span class="stat-card__value">{{ store.transactions.length }} 笔</span>
      </div>
    </section>

    <button v-if="needBackup" class="banner" @click="router.push('/me/data')">
      <span class="banner__icon"><AppIcon name="shield" :size="18" /></span>
      <span class="banner__text">
        <strong>建议导出一次备份</strong>
        <span>数据只在本机，清除浏览器数据会丢失</span>
      </span>
      <AppIcon name="chevron-right" :size="18" />
    </button>

    <section class="list menu">
      <button class="row" @click="router.push('/me/accounts')">
        <span class="bubble bubble--soft"><AppIcon name="wallet" :size="18" /></span>
        <span class="row__main">
          <span class="row__title">账户管理</span>
          <span class="row__sub">现金、微信、支付宝、银行卡…</span>
        </span>
        <AppIcon name="chevron-right" :size="18" class="muted" />
      </button>
      <button class="row" @click="router.push('/me/categories')">
        <span class="bubble bubble--soft"><AppIcon name="tag" :size="18" /></span>
        <span class="row__main">
          <span class="row__title">分类管理</span>
          <span class="row__sub">自定义收支分类与图标</span>
        </span>
        <AppIcon name="chevron-right" :size="18" class="muted" />
      </button>
      <button class="row" @click="router.push('/me/budget')">
        <span class="bubble bubble--soft"><AppIcon name="target" :size="18" /></span>
        <span class="row__main">
          <span class="row__title">月度预算</span>
          <span class="row__sub">总预算与分类预算</span>
        </span>
        <AppIcon name="chevron-right" :size="18" class="muted" />
      </button>
      <button class="row" @click="router.push('/me/data')">
        <span class="bubble bubble--soft"><AppIcon name="download" :size="18" /></span>
        <span class="row__main">
          <span class="row__title">数据备份与导出</span>
          <span class="row__sub">{{ lastBackupLabel }}</span>
        </span>
        <AppIcon name="chevron-right" :size="18" class="muted" />
      </button>
      <button class="row" @click="router.push('/me/trash')">
        <span class="bubble bubble--soft"><AppIcon name="trash" :size="18" /></span>
        <span class="row__main">
          <span class="row__title">回收站</span>
          <span class="row__sub">
            {{ deletedCount > 0 ? `${deletedCount} 条待处理 · 保留 30 天` : '删除的记录会保留 30 天' }}
          </span>
        </span>
        <AppIcon name="chevron-right" :size="18" class="muted" />
      </button>
      <button class="row" @click="router.push('/me/about')">
        <span class="bubble bubble--soft"><AppIcon name="info" :size="18" /></span>
        <span class="row__main">
          <span class="row__title">关于 Free Ledger</span>
          <span class="row__sub">隐私说明与开源协议</span>
        </span>
        <AppIcon name="chevron-right" :size="18" class="muted" />
      </button>
    </section>

    <section class="card">
      <h2 class="card-title">界面风格</h2>
      <div class="skin-grid">
        <button
          v-for="skin in SKINS"
          :key="skin.id"
          class="skin-card"
          :class="{ 'is-active': store.settings.skin === skin.id }"
          @click="setSkin(skin.id)"
        >
          <span
            class="skin-card__preview"
            :style="{ background: skin.bg, color: skin.text, fontFamily: skin.font }"
          >
            <span class="skin-card__num">¥1,280</span>
            <span class="skin-card__dot" :style="{ background: skin.accent }" />
          </span>
          <span class="skin-card__name">{{ skin.name }}</span>
          <span class="skin-card__desc">{{ skin.desc }}</span>
        </button>
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">外观主题</h2>
      <div class="seg">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          class="seg__item"
          :class="{ 'is-active': store.settings.theme === option.value }"
          @click="setTheme(option.value)"
        >
          <AppIcon :name="option.icon" :size="15" />
          {{ option.label }}
        </button>
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">货币符号</h2>
      <div class="chip-group">
        <button
          v-for="item in currencyOptions"
          :key="item"
          class="chip"
          :class="{ 'is-active': store.settings.currency === item }"
          @click="setCurrency(item)"
        >
          {{ item }}
        </button>
      </div>
    </section>

    <footer class="profile-footer">
      <p>数据仅保存在本机浏览器中，不上传、不联网。</p>
      <p>MIT License · v{{ appVersion }}</p>
    </footer>
  </div>
</template>
