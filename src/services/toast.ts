import { ref } from 'vue'

export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

export const toasts = ref<ToastItem[]>([])

let sequence = 0

export function toast(message: string, type: ToastItem['type'] = 'success'): void {
  const id = ++sequence
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }, 2400)
}
