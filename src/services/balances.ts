import type { Account, Transaction } from '../db/schema'

/**
 * 余额恒等式：余额 = 期初 + 收入 − 支出 + 转入 − 转出。
 * 返回 accountId → 分。
 */
export function computeBalances(accounts: Account[], transactions: Transaction[]): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const account of accounts) balances[account.id] = account.initialBalanceCents

  for (const t of transactions) {
    if (t.kind === 'expense') {
      balances[t.accountId] = (balances[t.accountId] ?? 0) - t.amountCents
    } else if (t.kind === 'income') {
      balances[t.accountId] = (balances[t.accountId] ?? 0) + t.amountCents
    } else {
      balances[t.accountId] = (balances[t.accountId] ?? 0) - t.amountCents
      if (t.toAccountId) {
        balances[t.toAccountId] = (balances[t.toAccountId] ?? 0) + t.amountCents
      }
    }
  }
  return balances
}

/** 所有账户余额之和。 */
export function totalBalance(balances: Record<string, number>): number {
  return Object.values(balances).reduce((sum, value) => sum + value, 0)
}
