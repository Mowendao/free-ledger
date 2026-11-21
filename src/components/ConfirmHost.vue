<script setup lang="ts">
import { ref } from 'vue'
import { confirmState, resolveConfirm } from '@/services/confirm'
import { useModalA11y } from '@/composables/useModalA11y'

const dialogRef = ref<HTMLElement | null>(null)

useModalA11y(
  () => confirmState.open,
  () => resolveConfirm(false),
  dialogRef
)
</script>

<template>
  <Transition name="fade">
    <div v-if="confirmState.open" class="dialog-mask" @click.self="resolveConfirm(false)">
      <div
        ref="dialogRef"
        class="dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="confirmState.title"
        tabindex="-1"
      >
        <h3 class="dialog__title">{{ confirmState.title }}</h3>
        <p v-if="confirmState.message" class="dialog__message">{{ confirmState.message }}</p>
        <div class="dialog__actions">
          <button class="btn" @click="resolveConfirm(false)">{{ confirmState.cancelText }}</button>
          <button
            class="btn"
            :class="confirmState.danger ? 'btn--danger' : 'btn--primary'"
            @click="resolveConfirm(true)"
          >
            {{ confirmState.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
