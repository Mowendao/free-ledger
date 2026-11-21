import { describe, expect, it } from 'vitest'
import type { Transaction } from '@/db/schema'
import { categoryTotals, ofMonth, percent, summarize, trend } from '@/services/stats'

let sequence = 0

function tx(partial: Partial<Transaction>): Transaction {
  sequence += 1
  return {
    id: `tx-${sequence}`,
    kind: 'expense',
    amountCents: 1000,
    categoryId: 'food',
    accountId: 'cash',
    toAccountId: null,
    date: '2026-11-10',
    note: '',
    createdAt: sequence,
    updatedAt: sequence,
    ...partial
  }
}

describe('summarize', () => {
  it('只统计收入与支出，转账不影响结余', () => {
    const summary = summarize([
      tx({ kind: 'expense', amountCents: 3000 }),
      tx({ kind: 'income', amountCents: 10000 }),
      tx({ kind: 'transfer', amountCents: 5000, categoryId: null, toAccountId: 'bank' })
    ])
    expect(summary).toEqual({ income: 10000, expense: 3000, net: 7000 })
  })
})

describe('categoryTotals', () => {
  it('按分类汇总并降序', () => {
    const totals = categoryTotals(
      [
        tx({ categoryId: 'food', amountCents: 2000 }),
        tx({ categoryId: 'food', amountCents: 1000 }),
        tx({ categoryId: 'transport', amountCents: 5000 })
      ],
      'expense'
    )
    expect(totals).toEqual([
      { categoryId: 'transport', amountCents: 5000 },
      { categoryId: 'food', amountCents: 3000 }
    ])
  })

  it('未分类归入 null', () => {
    const totals = categoryTotals([tx({ categoryId: null, amountCents: 800 })], 'expense')
    expect(totals[0]).toEqual({ categoryId: null, amountCents: 800 })
  })

  it('忽略另一类型', () => {
    const totals = categoryTotals([tx({ kind: 'income', amountCents: 800 })], 'expense')
    expect(totals).toEqual([])
  })
})

describe('trend', () => {
  it('补齐没有记录的月份', () => {
    const data = trend(
      [tx({ date: '2026-09-03', amountCents: 900 }), tx({ date: '2026-11-02', amountCents: 500 })],
      ['2026-09', '2026-10', '2026-11']
    )
    expect(data.map((item) => item.month)).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(data[0]).toEqual({ month: '2026-09', income: 0, expense: 900 })
    expect(data[1]).toEqual({ month: '2026-10', income: 0, expense: 0 })
    expect(data[2]).toEqual({ month: '2026-11', income: 0, expense: 500 })
  })

  it('忽略范围外月份', () => {
    const data = trend([tx({ date: '2025-01-01' })], ['2026-11'])
    expect(data[0].expense).toBe(0)
  })
})

describe('percent 与 ofMonth', () => {
  it('百分比保留一位小数', () => {
    expect(percent(1, 3)).toBe(33.3)
    expect(percent(1, 0)).toBe(0)
  })

  it('按月份筛选', () => {
    const rows = [tx({ date: '2026-11-01' }), tx({ date: '2026-10-31' })]
    expect(ofMonth(rows, '2026-11')).toHaveLength(1)
  })
})
