import { ref } from 'vue'

export interface ToastAction {
  label: string
  onClick: () => void | Promise<void>
}

export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
  action?: ToastAction
}

export const toasts = ref<ToastItem[]>([])

let sequence = 0

function removeToast(id: number): void {
  toasts.value = toasts.value.filter((item) => item.id !== id)
}

export function toast(
  message: string,
  type: ToastItem['type'] = 'success',
  action?: ToastAction
): void {
  const id = ++sequence
  toasts.value.push({ id, message, type, action })
  // 带操作的提示停留更久，给用户撤销的机会
  setTimeout(() => removeToast(id), action ? 6000 : 2400)
}

export async function runToastAction(item: ToastItem): Promise<void> {
  removeToast(item.id)
  await item.action?.onClick()
}
