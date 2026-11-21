/* 全时段搜索与筛选：与月份无关，支持备注/分类/账户/日期/金额关键字与金额区间。 */
import type { Account, Category, Transaction } from '@/db/schema'

export interface SearchFilter {
  keyword?: string
  minCents?: number | null
  maxCents?: number | null
  kind?: 'all' | 'expense' | 'income'
  categoryId?: string | null
  accountId?: string
}

export function filterTransactions(
  transactions: Transaction[],
  filter: SearchFilter,
  categories: Category[],
  accounts: Account[]
): Transaction[] {
  const categoryName = new Map(categories.map((category) => [category.id, category.name]))
  const accountName = new Map(accounts.map((account) => [account.id, account.name]))
  const keyword = filter.keyword?.trim().toLowerCase() ?? ''
  const min = filter.minCents ?? null
  const max = filter.maxCents ?? null

  return transactions
    .filter((transaction) => {
      if (filter.kind && filter.kind !== 'all' && transaction.kind !== filter.kind) return false
      if (filter.categoryId && transaction.categoryId !== filter.categoryId) return false
      if (filter.accountId && transaction.accountId !== filter.accountId) return false
      if (min !== null && transaction.amountCents < min) return false
      if (max !== null && transaction.amountCents > max) return false
      if (!keyword) return true

      const haystack = [
        transaction.note,
        transaction.date,
        transaction.kind === 'transfer'
          ? '转账'
          : categoryName.get(transaction.categoryId ?? '') ?? '',
        accountName.get(transaction.accountId) ?? '',
        accountName.get(transaction.toAccountId ?? '') ?? '',
        (transaction.amountCents / 100).toFixed(2)
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
    .sort((a, b) =>
      a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)
    )
}
