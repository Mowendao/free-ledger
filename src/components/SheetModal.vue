<script setup lang="ts">
defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="sheet-mask" @click.self="emit('close')">
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet__handle" />
        <h3 v-if="title" class="sheet__title">{{ title }}</h3>
        <slot />
      </div>
    </div>
  </Transition>
</template>
