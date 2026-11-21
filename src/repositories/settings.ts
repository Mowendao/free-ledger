import { db, DEFAULT_SETTINGS, type AppSettings } from '@/db/schema'
import { resolveSkin } from '@/services/skins'
import {
  sanitizeMerchantRules,
  upsertMerchantRule,
  type MerchantRule
} from '@/services/merchantRules'

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray()
  const map = new Map(rows.map((row) => [row.key, row.value]))
  return {
    theme: (map.get('theme') as AppSettings['theme']) ?? DEFAULT_SETTINGS.theme,
    skin: resolveSkin(map.get('skin')),
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

const MERCHANT_RULES_KEY = 'merchantRules'

export async function getMerchantRules(): Promise<MerchantRule[]> {
  const row = await db.settings.get(MERCHANT_RULES_KEY)
  return sanitizeMerchantRules(row?.value)
}

export async function setMerchantRules(rules: MerchantRule[]): Promise<void> {
  await db.settings.put({ key: MERCHANT_RULES_KEY, value: sanitizeMerchantRules(rules) })
}

/** 用户给某笔流水选了分类后，记住商户 → 分类。 */
export async function learnMerchantRule(note: string, categoryId: string): Promise<void> {
  const rules = await getMerchantRules()
  const next = upsertMerchantRule(rules, note, categoryId)
  if (next !== rules) await setMerchantRules(next)
}
