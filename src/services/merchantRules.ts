/* 商户记忆：从用户自己的分类行为里学习「交易对方 → 分类」，仅存本机。
   规则随 settings 表一起导出，不联网。 */
import type { Transaction } from '@/db/schema'

export interface MerchantRule {
  pattern: string
  categoryId: string
}

export const MAX_MERCHANT_RULES = 200

/** 取备注的第一段作为商户名，统一小写与空白。 */
export function normalizeMerchant(note: string): string {
  return note
    .split('·')[0]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 40)
}

export function upsertMerchantRule(
  rules: MerchantRule[],
  note: string,
  categoryId: string
): MerchantRule[] {
  const pattern = normalizeMerchant(note)
  if (!pattern || !categoryId) return rules
  const rest = rules.filter((rule) => rule.pattern !== pattern)
  return [{ pattern, categoryId }, ...rest].slice(0, MAX_MERCHANT_RULES)
}

/** 对未分类流水套用规则；只认仍存在的分类，绝不覆盖已有分类。 */
export function applyMerchantRules(
  transactions: Transaction[],
  rules: MerchantRule[],
  categoryIds: Set<string>
): { transactions: Transaction[]; applied: number } {
  const validRules = rules.filter((rule) => patternOk(rule) && categoryIds.has(rule.categoryId))
  if (validRules.length === 0) return { transactions, applied: 0 }

  let applied = 0
  const mapped = transactions.map((transaction) => {
    if (transaction.categoryId) return transaction
    const haystack = transaction.note.trim().toLowerCase()
    const rule = validRules.find((item) => haystack.includes(item.pattern))
    if (!rule) return transaction
    applied += 1
    return { ...transaction, categoryId: rule.categoryId }
  })

  return { transactions: mapped, applied }
}

function patternOk(rule: MerchantRule): boolean {
  return typeof rule.pattern === 'string' && rule.pattern.trim().length > 0
}

export function sanitizeMerchantRules(value: unknown): MerchantRule[] {
  if (!Array.isArray(value)) return []
  const result: MerchantRule[] = []
  const seen = new Set<string>()

  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const pattern = typeof record.pattern === 'string' ? record.pattern.trim() : ''
    const categoryId = typeof record.categoryId === 'string' ? record.categoryId : ''
    if (!pattern || !categoryId || seen.has(pattern)) continue
    seen.add(pattern)
    result.push({ pattern, categoryId })
    if (result.length >= MAX_MERCHANT_RULES) break
  }

  return result
}
