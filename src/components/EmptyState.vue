<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{ icon?: string; title: string; text?: string }>(), {
  icon: 'info',
  text: ''
})
</script>

<template>
  <div class="empty">
    <span class="empty__icon"><AppIcon :name="icon" :size="26" /></span>
    <p class="empty__title">{{ title }}</p>
    <p v-if="text" class="empty__text">{{ text }}</p>
    <slot />
  </div>
</template>
