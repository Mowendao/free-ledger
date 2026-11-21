import { describe, expect, it } from 'vitest'
import type { Account, Category, Transaction } from '@/db/schema'
import { filterTransactions } from '@/services/search'

const categories: Category[] = [
  {
    id: 'food',
    kind: 'expense',
    name: '餐饮',
    icon: 'food',
    color: '#000',
    builtin: true,
    archived: false,
    sortOrder: 0,
    createdAt: 0
  },
  {
    id: 'salary',
    kind: 'income',
    name: '工资',
    icon: 'salary',
    color: '#000',
    builtin: true,
    archived: false,
    sortOrder: 1,
    createdAt: 0
  }
]

const accounts: Account[] = [
  {
    id: 'wechat',
    name: '微信',
    type: 'wechat',
    initialBalanceCents: 0,
    archived: false,
    sortOrder: 0,
    createdAt: 0
  },
  {
    id: 'bank',
    name: '银行卡',
    type: 'bank',
    initialBalanceCents: 0,
    archived: false,
    sortOrder: 1,
    createdAt: 0
  }
]

let sequence = 0

function tx(partial: Partial<Transaction>): Transaction {
  sequence += 1
  return {
    id: `tx-${sequence}`,
    kind: 'expense',
    amountCents: 1000,
    categoryId: 'food',
    accountId: 'wechat',
    toAccountId: null,
    date: '2026-11-21',
    note: '',
    createdAt: sequence,
    updatedAt: sequence,
    ...partial
  }
}

const rows = [
  tx({ note: '午餐', amountCents: 3200, date: '2026-11-21' }),
  tx({ note: '地铁', amountCents: 450, date: '2026-11-20', categoryId: null }),
  tx({ kind: 'income', note: '工资', amountCents: 1200000, date: '2026-10-10', categoryId: 'salary', accountId: 'bank' }),
  tx({ note: '医院', amountCents: 12000, date: '2026-09-01' })
]

describe('全时段搜索', () => {
  it('按备注匹配，不受月份限制', () => {
    const result = filterTransactions(rows, { keyword: '午餐' }, categories, accounts)
    expect(result).toHaveLength(1)
    expect(result[0].note).toBe('午餐')
  })

  it('按分类名、账户名、日期与金额匹配', () => {
    expect(filterTransactions(rows, { keyword: '餐饮' }, categories, accounts)).toHaveLength(2)
    expect(filterTransactions(rows, { keyword: '银行卡' }, categories, accounts)).toHaveLength(1)
    expect(filterTransactions(rows, { keyword: '2026-09' }, categories, accounts)).toHaveLength(1)
    expect(filterTransactions(rows, { keyword: '32.00' }, categories, accounts)).toHaveLength(1)
  })

  it('金额区间为闭区间', () => {
    const result = filterTransactions(rows, { minCents: 450, maxCents: 12000 }, categories, accounts)
    expect(result.map((item) => item.amountCents).sort((a, b) => a - b)).toEqual([450, 3200, 12000])
  })

  it('叠加类型、分类、账户筛选', () => {
    const expense = filterTransactions(rows, { kind: 'expense' }, categories, accounts)
    expect(expense.every((item) => item.kind === 'expense')).toBe(true)

    const food = filterTransactions(rows, { categoryId: 'food' }, categories, accounts)
    expect(food).toHaveLength(2)

    const bank = filterTransactions(rows, { accountId: 'bank' }, categories, accounts)
    expect(bank).toHaveLength(1)
  })

  it('结果按日期倒序', () => {
    const result = filterTransactions(rows, {}, categories, accounts)
    const dates = result.map((item) => item.date)
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)))
  })
})
