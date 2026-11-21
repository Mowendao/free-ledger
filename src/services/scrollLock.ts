/* 弹层滚动锁：支持多个弹层叠加，最后一个关闭时才恢复页面滚动。 */

let lockCount = 0
let previousOverflow = ''

export function lockScroll(): void {
  if (typeof document === 'undefined') return
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
}

export function unlockScroll(): void {
  if (typeof document === 'undefined' || lockCount === 0) return
  lockCount -= 1
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow
  }
}
