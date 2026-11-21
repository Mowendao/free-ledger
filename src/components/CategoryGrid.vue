<script setup lang="ts">
import type { Category } from '@/db/schema'
import AppIcon from './AppIcon.vue'

defineProps<{ categories: Category[]; modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()
</script>

<template>
  <div class="category-strip" role="listbox" aria-label="选择分类">
    <button
      v-for="category in categories"
      :key="category.id"
      class="category-strip__item"
      :class="{ 'is-active': category.id === modelValue }"
      role="option"
      :aria-selected="category.id === modelValue"
      @click="emit('update:modelValue', category.id)"
    >
      <span
        class="category-strip__icon"
        :style="{ background: `${category.color}1f`, color: category.color }"
      >
        <AppIcon :name="category.icon" :size="22" />
      </span>
      <span class="category-strip__name">{{ category.name }}</span>
    </button>
    <slot />
  </div>
</template>
