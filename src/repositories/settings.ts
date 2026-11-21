import { db, DEFAULT_SETTINGS, type AppSettings } from '@/db/schema'

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray()
  const map = new Map(rows.map((row) => [row.key, row.value]))
  return {
    theme: (map.get('theme') as AppSettings['theme']) ?? DEFAULT_SETTINGS.theme,
    currency: (map.get('currency') as string) ?? DEFAULT_SETTINGS.currency,
    lastBackupAt: (map.get('lastBackupAt') as string) ?? DEFAULT_SETTINGS.lastBackupAt
  }
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  await db.settings.put({ key, value })
}

export async function markBackupNow(): Promise<void> {
  await setSetting('lastBackupAt', new Date().toISOString())
}
