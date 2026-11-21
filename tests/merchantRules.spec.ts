import { describe, expect, it } from 'vitest'
import type { Transaction } from '@/db/schema'
import {
  applyMerchantRules,
  normalizeMerchant,
  sanitizeMerchantRules,
  upsertMerchantRule,
  type MerchantRule
} from '@/services/merchantRules'

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36),
    kind: 'expense',
    amountCents: 1000,
    categoryId: null,
    accountId: 'acc',
    toAccountId: null,
    date: '2026-11-21',
    note: '',
    createdAt: 0,
    updatedAt: 0,
    ...partial
  }
}

describe('商户名归一化', () => {
  it('取备注第一段并统一大小写与空白', () => {
    expect(normalizeMerchant(' 便利店 · 矿泉水')).toBe('便利店')
    expect(normalizeMerchant('Starbucks  Coffee')).toBe('starbucks coffee')
    expect(normalizeMerchant('')).toBe('')
  })
})

describe('规则学习', () => {
  it('同一商户的新分类置顶并去重', () => {
    const rules: MerchantRule[] = [
      { pattern: '便利店', categoryId: 'old' },
      { pattern: '地铁', categoryId: 'transport' }
    ]
    const next = upsertMerchantRule(rules, '便利店 · 早餐', 'food')
    expect(next[0]).toEqual({ pattern: '便利店', categoryId: 'food' })
    expect(next).toHaveLength(2)
  })

  it('空备注不产生规则', () => {
    expect(upsertMerchantRule([], '   ', 'food')).toEqual([])
  })
})

describe('规则套用', () => {
  const categoryIds = new Set(['food', 'transport'])

  it('只给未分类且匹配的流水套用', () => {
    const rows = [
      tx({ note: '便利店 · 矿泉水' }),
      tx({ note: '便利店 · 咖啡', categoryId: 'food' }),
      tx({ note: '地铁' })
    ]
    const { transactions, applied } = applyMerchantRules(
      rows,
      [{ pattern: '便利店', categoryId: 'food' }],
      categoryIds
    )

    expect(applied).toBe(1)
    expect(transactions[0].categoryId).toBe('food')
    expect(transactions[1].categoryId).toBe('food')
    expect(transactions[2].categoryId).toBeNull()
  })

  it('忽略指向已删除分类的规则', () => {
    const { transactions, applied } = applyMerchantRules(
      [tx({ note: '便利店 · 水' })],
      [{ pattern: '便利店', categoryId: 'missing' }],
      categoryIds
    )
    expect(applied).toBe(0)
    expect(transactions[0].categoryId).toBeNull()
  })
})

describe('规则清洗', () => {
  it('过滤非法项并按 pattern 去重', () => {
    const cleaned = sanitizeMerchantRules([
      { pattern: '便利店', categoryId: 'food' },
      { pattern: '便利店', categoryId: 'other' },
      { pattern: '', categoryId: 'food' },
      { categoryId: 'food' },
      null,
      'bad'
    ])
    expect(cleaned).toEqual([{ pattern: '便利店', categoryId: 'food' }])
  })
})
