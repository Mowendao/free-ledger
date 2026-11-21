import { describe, expect, it } from 'vitest'
import type { Account, Transaction } from '@/db/schema'
import { computeBalances, totalBalance } from '@/services/balances'

function account(id: string, initial = 0): Account {
  return {
    id,
    name: id,
    type: 'cash',
    initialBalanceCents: initial,
    archived: false,
    sortOrder: 0,
    createdAt: 0
  }
}

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36),
    kind: 'expense',
    amountCents: 0,
    categoryId: null,
    accountId: 'cash',
    toAccountId: null,
    date: '2026-11-01',
    note: '',
    createdAt: 0,
    updatedAt: 0,
    ...partial
  }
}

describe('computeBalances', () => {
  it('余额 = 期初 + 收入 − 支出 + 转入 − 转出', () => {
    const balances = computeBalances(
      [account('cash', 10000), account('bank', 0)],
      [
        tx({ kind: 'expense', accountId: 'cash', amountCents: 3000 }),
        tx({ kind: 'income', accountId: 'cash', amountCents: 5000 }),
        tx({ kind: 'transfer', accountId: 'cash', toAccountId: 'bank', amountCents: 4000 })
      ]
    )
    expect(balances.cash).toBe(10000 - 3000 + 5000 - 4000)
    expect(balances.bank).toBe(4000)
  })

  it('允许负余额（信用卡场景）', () => {
    const balances = computeBalances(
      [account('credit', 0)],
      [tx({ kind: 'expense', accountId: 'credit', amountCents: 2500 })]
    )
    expect(balances.credit).toBe(-2500)
  })

  it('未知账户也能累计', () => {
    const balances = computeBalances([], [tx({ accountId: 'ghost', amountCents: 700 })])
    expect(balances.ghost).toBe(-700)
  })

  it('所有账户余额之和', () => {
    expect(totalBalance({ a: 100, b: -30 })).toBe(70)
  })
})
