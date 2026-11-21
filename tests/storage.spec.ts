import { describe, expect, it } from 'vitest'
import { formatBytes, getStorageStatus } from '@/services/storage'

describe('formatBytes', () => {
  it('人类可读的存储大小', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(10 * 1024)).toBe('10 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })
})

describe('getStorageStatus', () => {
  it('环境不支持 StorageManager 时安全降级', async () => {
    const status = await getStorageStatus()
    expect(status.supported).toBe(false)
    expect(status.persisted).toBe(false)
    expect(status.usage).toBe(0)
  })
})
