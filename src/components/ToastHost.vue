<script setup lang="ts">
import { runToastAction, toasts } from '@/services/toast'
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="item in toasts"
        :key="item.id"
        class="toast"
        :class="`toast--${item.type}`"
      >
        <span class="toast__message">{{ item.message }}</span>
        <button v-if="item.action" class="toast__action" @click="runToastAction(item)">
          {{ item.action.label }}
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
