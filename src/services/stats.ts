import type { Category, Transaction, TxKind } from '../db/schema'
import { monthOf } from './dates'

export interface Summary {
  income: number
  expense: number
  net: number
}

export interface CategoryTotal {
  categoryId: string | null
  amountCents: number
}

export interface MonthTotal {
  month: string
  income: number
  expense: number
}

export function summarize(transactions: Transaction[]): Summary {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (t.kind === 'income') income += t.amountCents
    else if (t.kind === 'expense') expense += t.amountCents
  }
  return { income, expense, net: income - expense }
}

/** 按分类汇总某个类型（支出/收入）的金额，降序。转账不计入。 */
export function categoryTotals(transactions: Transaction[], kind: TxKind): CategoryTotal[] {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.kind !== kind) continue
    const key = t.categoryId ?? '__none__'
    map.set(key, (map.get(key) ?? 0) + t.amountCents)
  }
  return [...map.entries()]
    .map(([categoryId, amountCents]) => ({
      categoryId: categoryId === '__none__' ? null : categoryId,
      amountCents
    }))
    .sort((a, b) => b.amountCents - a.amountCents)
}

/** 分类 id → 分类对象。 */
export function categoryMap(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((c) => [c.id, c]))
}

/** 近 N 个月收支趋势。 */
export function trend(transactions: Transaction[], months: string[]): MonthTotal[] {
  const map = new Map<string, MonthTotal>()
  for (const month of months) map.set(month, { month, income: 0, expense: 0 })
  for (const t of transactions) {
    const entry = map.get(monthOf(t.date))
    if (!entry) continue
    if (t.kind === 'income') entry.income += t.amountCents
    else if (t.kind === 'expense') entry.expense += t.amountCents
  }
  return months.map((m) => map.get(m)!)
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 1000) / 10
}

/** 从 transactions 中挑出某月数据。 */
export function ofMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((t) => monthOf(t.date) === month)
}
