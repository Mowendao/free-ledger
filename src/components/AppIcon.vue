<script setup lang="ts">
import { computed } from 'vue'
import { ICONS } from '@/services/icons'

const props = withDefaults(defineProps<{ name: string; size?: number | string }>(), {
  size: 20
})

const markup = computed(() => ICONS[props.name] ?? ICONS.other)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="markup"
  />
</template>
