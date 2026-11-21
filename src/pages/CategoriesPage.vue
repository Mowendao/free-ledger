<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { Category, CategoryKind } from '@/db/schema'
import { useLedgerStore } from '@/stores/useLedger'
import { createCategory, deleteCategory, updateCategory } from '@/repositories/categories'
import { toast } from '@/services/toast'
import { confirmDialog } from '@/services/confirm'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import SheetModal from '@/components/SheetModal.vue'

const store = useLedgerStore()

const kind = ref<CategoryKind>('expense')
const sheetOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const form = reactive({
  name: '',
  icon: 'other',
  color: '#10b981'
})

const ICON_CHOICES = [
  'food', 'transport', 'shopping', 'home', 'fun', 'medical', 'edu', 'phone',
  'gift', 'other', 'salary', 'bonus', 'invest', 'redpacket', 'wallet', 'tag',
  'target', 'cash', 'card', 'transfer', 'bank', 'credit'
]

const COLOR_CHOICES = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981',
  '#14b8a6', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#f43f5e', '#94a3b8', '#64748b'
]

const categories = computed(() =>
  store.categories.filter((category) => category.kind === kind.value)
)

function openAdd(): void {
  editingId.value = null
  form.name = ''
  form.icon = 'other'
  form.color = '#10b981'
  sheetOpen.value = true
}

function openEdit(category: Category): void {
  editingId.value = category.id
  form.name = category.name
  form.icon = category.icon
  form.color = category.color
  sheetOpen.value = true
}

async function save(): Promise<void> {
  if (saving.value) return
  if (!form.name.trim()) {
    toast('请输入分类名称', 'error')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateCategory(editingId.value, { name: form.name, icon: form.icon, color: form.color })
      toast('分类已更新')
    } else {
      await createCategory({ kind: kind.value, name: form.name, icon: form.icon, color: form.color })
      toast('分类已创建')
    }
    await store.reloadBasics()
    sheetOpen.value = false
  } catch (error) {
    toast(error instanceof Error ? error.message : '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

async function remove(): Promise<void> {
  if (!editingId.value) return
  const ok = await confirmDialog({
    title: '删除分类？',
    message: '内置分类和被流水引用的分类不能删除。',
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
  const result = await deleteCategory(editingId.value)
  if (!result.ok) {
    toast(result.reason ?? '无法删除', 'error')
    return
  }
  await store.reloadBasics()
  sheetOpen.value = false
  toast('分类已删除')
}
</script>

<template>
  <div class="page">
    <PageHeader title="分类管理">
      <template #right>
        <button class="icon-btn" aria-label="新增分类" @click="openAdd">
          <AppIcon name="plus" :size="20" />
        </button>
      </template>
    </PageHeader>

    <div class="seg">
      <button class="seg__item" :class="{ 'is-active': kind === 'expense' }" @click="kind = 'expense'">
        支出分类
      </button>
      <button class="seg__item" :class="{ 'is-active': kind === 'income' }" @click="kind = 'income'">
        收入分类
      </button>
    </div>

    <div class="category-manage">
      <button
        v-for="category in categories"
        :key="category.id"
        class="category-manage__item"
        @click="openEdit(category)"
      >
        <span
          class="category-manage__icon"
          :style="{ background: `${category.color}1f`, color: category.color }"
        >
          <AppIcon :name="category.icon" :size="22" />
        </span>
        <span class="category-manage__name">{{ category.name }}</span>
        <span v-if="category.builtin" class="category-manage__badge">内置</span>
      </button>

      <button class="category-manage__item category-manage__item--add" @click="openAdd">
        <span class="category-manage__icon"><AppIcon name="plus" :size="22" /></span>
        <span class="category-manage__name">新建</span>
      </button>
    </div>

    <p class="hint">长按或点击分类可修改名称、图标与颜色；内置分类不可删除。</p>
  </div>

  <SheetModal
    :open="sheetOpen"
    :title="editingId ? '编辑分类' : '新建分类'"
    @close="sheetOpen = false"
  >
    <div class="form">
      <label class="field">
        <span class="field__label">分类名称</span>
        <input v-model="form.name" class="input" maxlength="10" placeholder="例如：咖啡" />
      </label>

      <div class="field">
        <span class="field__label">图标</span>
        <div class="icon-grid">
          <button
            v-for="icon in ICON_CHOICES"
            :key="icon"
            class="icon-grid__item"
            :class="{ 'is-active': form.icon === icon }"
            :style="form.icon === icon ? { color: form.color, borderColor: form.color } : undefined"
            @click="form.icon = icon"
          >
            <AppIcon :name="icon" :size="20" />
          </button>
        </div>
      </div>

      <div class="field">
        <span class="field__label">颜色</span>
        <div class="color-grid">
          <button
            v-for="color in COLOR_CHOICES"
            :key="color"
            class="color-grid__item"
            :class="{ 'is-active': form.color === color }"
            :style="{ background: color }"
            :aria-label="`颜色 ${color}`"
            @click="form.color = color"
          />
        </div>
      </div>

      <div class="form__actions">
        <button v-if="editingId" class="btn btn--danger" @click="remove">删除</button>
        <button class="btn btn--primary form__grow" :disabled="saving" @click="save">保存</button>
      </div>
    </div>
  </SheetModal>
</template>
