import { nextTick, onBeforeUnmount, watch } from 'vue'
import type { Ref } from 'vue'
import { lockScroll, unlockScroll } from '@/services/scrollLock'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 弹层可访问性：打开时锁定背景滚动、聚焦容器、捕获 Esc 与 Tab 焦点循环；
 * 关闭时解除滚动锁并把焦点还给触发元素。
 */
export function useModalA11y(
  isOpen: () => boolean,
  close: () => void,
  container: Ref<HTMLElement | null>
): void {
  let active = false
  let lastFocused: HTMLElement | null = null

  function focusableNodes(): HTMLElement[] {
    const root = container.value
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null
    )
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return

    const root = container.value
    if (!root) return
    const nodes = focusableNodes()
    if (nodes.length === 0) {
      event.preventDefault()
      root.focus()
      return
    }

    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const current = document.activeElement

    if (event.shiftKey && (current === first || current === root)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && current === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function activate(): void {
    if (active) return
    active = true
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    lockScroll()
    document.addEventListener('keydown', onKeydown)
    nextTick(() => container.value?.focus())
  }

  function deactivate(): void {
    if (!active) return
    active = false
    unlockScroll()
    document.removeEventListener('keydown', onKeydown)
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus()
    lastFocused = null
  }

  watch(isOpen, (open) => {
    if (open) activate()
    else deactivate()
  })

  onBeforeUnmount(deactivate)
}
