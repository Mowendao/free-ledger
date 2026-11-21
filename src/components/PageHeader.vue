<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'

defineProps<{ title: string }>()
const router = useRouter()

function goBack(): void {
  if (window.history.length > 1) router.back()
  else router.push('/me')
}
</script>

<template>
  <header class="page-header">
    <button class="page-header__back" aria-label="返回" @click="goBack">
      <AppIcon name="chevron-left" :size="22" />
    </button>
    <h1 class="page-header__title">{{ title }}</h1>
    <div class="page-header__right"><slot name="right" /></div>
  </header>
</template>
