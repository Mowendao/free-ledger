<script setup lang="ts">
import AppIcon from './AppIcon.vue'

const tabs = [
  { to: '/record', label: '记账', icon: 'plus' },
  { to: '/ledger', label: '明细', icon: 'list' },
  { to: '/stats', label: '统计', icon: 'chart' },
  { to: '/me', label: '我的', icon: 'user' }
]
</script>

<template>
  <nav class="tabbar" aria-label="主导航">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="tabbar__item"
      active-class="is-active"
    >
      <span class="tabbar__icon"><AppIcon :name="tab.icon" :size="21" /></span>
      <span>{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>
