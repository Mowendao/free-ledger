/* 本地存储状态：申请持久化、读取配额。浏览器可能回收 IndexedDB，持久化能显著降低风险。 */

export interface StorageStatus {
  supported: boolean
  persisted: boolean
  usage: number
  quota: number
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
  if (!storage?.estimate) {
    return { supported: false, persisted: false, usage: 0, quota: 0 }
  }

  const [estimate, persisted] = await Promise.all([
    storage.estimate().catch(() => ({}) as StorageEstimate),
    storage.persisted ? storage.persisted().catch(() => false) : Promise.resolve(false)
  ])

  return {
    supported: true,
    persisted: Boolean(persisted),
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0
  }
}

/** 请求持久化存储；浏览器可拒绝（例如未满足参与度条件）。 */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
  if (!storage?.persist) return false
  try {
    return await storage.persist()
  } catch {
    return false
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  const text = Number.isInteger(value)
    ? String(value)
    : value >= 10
      ? Math.round(value).toString()
      : value.toFixed(1)
  return `${text} ${units[index]}`
}
