// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { lockScroll, unlockScroll } from '@/services/scrollLock'

describe('弹层滚动锁', () => {
  it('多层叠加时只恢复一次', () => {
    lockScroll()
    expect(document.body.style.overflow).toBe('hidden')
    lockScroll()
    unlockScroll()
    expect(document.body.style.overflow).toBe('hidden')
    unlockScroll()
    expect(document.body.style.overflow).toBe('')
  })
})
