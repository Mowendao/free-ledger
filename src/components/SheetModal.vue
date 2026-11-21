<script setup lang="ts">
import { ref } from 'vue'
import { useModalA11y } from '@/composables/useModalA11y'

const props = defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ close: [] }>()
const sheetRef = ref<HTMLElement | null>(null)

useModalA11y(
  () => props.open,
  () => emit('close'),
  sheetRef
)
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="sheet-mask" @click.self="emit('close')">
      <div
        ref="sheetRef"
        class="sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="title ?? '弹层'"
        tabindex="-1"
      >
        <div class="sheet__handle" />
        <h3 v-if="title" class="sheet__title">{{ title }}</h3>
        <slot />
      </div>
    </div>
  </Transition>
</template>
