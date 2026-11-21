import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/schema'
import { resetDb } from '@/db/init'
import {
  countDeletedTransactions,
  createTransaction,
  deleteTransaction,
  emptyTrash,
  getTransaction,
  listDeletedTransactions,
  listTransactions,
  purgeTransaction,
  restoreTransaction
} from '@/repositories/transactions'
import { deleteAccount, listAccounts, createAccount } from '@/repositories/accounts'
import { createCategory, deleteCategory, listCategories } from '@/repositories/categories'
import { getBudget, setBudget } from '@/repositories/budgets'
import { getSettings, setSetting } from '@/repositories/settings'

beforeEach(async () => {
  await resetDb()
})

async function firstAccountId(): Promise<string> {
  const accounts = await listAccounts()
  return accounts[0].id
}

async function firstExpenseCategoryId(): Promise<string> {
  const categories = await listCategories('expense')
  return categories[0].id
}

describe('流水校验', () => {
  it('金额必须大于 0', async () => {
    await expect(
      createTransaction({
        kind: 'expense',
        amountCents: 0,
        categoryId: null,
        accountId: await firstAccountId(),
        toAccountId: null,
        date: '2026-11-21',
        note: ''
      })
    ).rejects.toThrow('金额必须大于 0')
  })

  it('拒绝非法日期', async () => {
    await expect(
      createTransaction({
        kind: 'expense',
        amountCents: 100,
        categoryId: null,
        accountId: await firstAccountId(),
        toAccountId: null,
        date: '2026-02-30',
        note: ''
      })
    ).rejects.toThrow('日期格式不正确')
  })

  it('转账不允许同账户', async () => {
    const id = await firstAccountId()
    await expect(
      createTransaction({
        kind: 'transfer',
        amountCents: 100,
        categoryId: null,
        accountId: id,
        toAccountId: id,
        date: '2026-11-21',
        note: ''
      })
    ).rejects.toThrow('转出与转入账户不能相同')
  })

  it('转账自动清空分类', async () => {
    const accounts = await listAccounts()
    const tx = await createTransaction({
      kind: 'transfer',
      amountCents: 500,
      categoryId: await firstExpenseCategoryId(),
      accountId: accounts[0].id,
      toAccountId: accounts[1].id,
      date: '2026-11-21',
      note: ''
    })
    expect(tx.categoryId).toBeNull()
  })
})

describe('列表查询', () => {
  it('按月份与关键词过滤', async () => {
    const accountId = await firstAccountId()
    const categoryId = await firstExpenseCategoryId()
    await createTransaction({ kind: 'expense', amountCents: 100, categoryId, accountId, toAccountId: null, date: '2026-11-01', note: '早餐' })
    await createTransaction({ kind: 'expense', amountCents: 200, categoryId, accountId, toAccountId: null, date: '2026-10-01', note: '晚餐' })

    const november = await listTransactions({ month: '2026-11' })
    expect(november).toHaveLength(1)
    expect(november[0].note).toBe('早餐')

    const keyword = await listTransactions({ keyword: '晚' })
    expect(keyword).toHaveLength(1)
    expect(keyword[0].amountCents).toBe(200)
  })
})

describe('软删除与撤销', () => {
  it('删除后不可见，撤销后恢复', async () => {
    const accountId = await firstAccountId()
    const categoryId = await firstExpenseCategoryId()
    const transaction = await createTransaction({
      kind: 'expense',
      amountCents: 800,
      categoryId,
      accountId,
      toAccountId: null,
      date: '2026-11-21',
      note: '测试'
    })

    await deleteTransaction(transaction.id)
    expect(await listTransactions({})).toHaveLength(0)
    expect(await getTransaction(transaction.id)).toBeUndefined()

    await restoreTransaction(transaction.id)
    expect(await listTransactions({})).toHaveLength(1)
    expect((await getTransaction(transaction.id))?.amountCents).toBe(800)
  })

  it('只有回收站流水时账户可以删除', async () => {
    const accountId = await firstAccountId()
    const transaction = await createTransaction({
      kind: 'expense',
      amountCents: 500,
      categoryId: await firstExpenseCategoryId(),
      accountId,
      toAccountId: null,
      date: '2026-11-21',
      note: ''
    })
    await deleteTransaction(transaction.id)
    expect((await deleteAccount(accountId)).ok).toBe(true)
  })
})

describe('回收站', () => {
  it('列出已删除记录，支持恢复与彻底删除', async () => {
    const accountId = await firstAccountId()
    const categoryId = await firstExpenseCategoryId()
    const first = await createTransaction({
      kind: 'expense',
      amountCents: 1200,
      categoryId,
      accountId,
      toAccountId: null,
      date: '2026-11-20',
      note: 'A'
    })
    const second = await createTransaction({
      kind: 'expense',
      amountCents: 3400,
      categoryId,
      accountId,
      toAccountId: null,
      date: '2026-11-19',
      note: 'B'
    })
    await deleteTransaction(first.id)
    await deleteTransaction(second.id)

    expect(await countDeletedTransactions()).toBe(2)
    expect(await listDeletedTransactions()).toHaveLength(2)

    await restoreTransaction(first.id)
    expect(await listDeletedTransactions()).toHaveLength(1)
    expect(await countDeletedTransactions()).toBe(1)

    await purgeTransaction(second.id)
    expect(await listDeletedTransactions()).toHaveLength(0)
    expect(await db.transactions.get(second.id)).toBeUndefined()
  })

  it('可以清空回收站', async () => {
    const accountId = await firstAccountId()
    const categoryId = await firstExpenseCategoryId()
    for (const amount of [100, 200]) {
      const transaction = await createTransaction({
        kind: 'expense',
        amountCents: amount,
        categoryId,
        accountId,
        toAccountId: null,
        date: '2026-11-18',
        note: ''
      })
      await deleteTransaction(transaction.id)
    }

    expect(await emptyTrash()).toBe(2)
    expect(await listDeletedTransactions()).toHaveLength(0)
    expect(await listTransactions({})).toHaveLength(0)
  })
})

describe('分类与账户保护', () => {
  it('内置分类不可删除', async () => {
    const categories = await listCategories('expense')
    const result = await deleteCategory(categories[0].id)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('内置')
  })

  it('被引用的自定义分类不可删除', async () => {
    const category = await createCategory({ kind: 'expense', name: '咖啡', icon: 'food', color: '#111111' })
    await createTransaction({
      kind: 'expense',
      amountCents: 1800,
      categoryId: category.id,
      accountId: await firstAccountId(),
      toAccountId: null,
      date: '2026-11-02',
      note: ''
    })
    const result = await deleteCategory(category.id)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('流水')
  })

  it('未被引用的自定义分类可删除', async () => {
    const category = await createCategory({ kind: 'expense', name: '临时', icon: 'other', color: '#222222' })
    expect((await deleteCategory(category.id)).ok).toBe(true)
    expect(await db.categories.get(category.id)).toBeUndefined()
  })

  it('有流水的账户不能删除', async () => {
    const accountId = await firstAccountId()
    await createTransaction({
      kind: 'expense',
      amountCents: 900,
      categoryId: await firstExpenseCategoryId(),
      accountId,
      toAccountId: null,
      date: '2026-11-03',
      note: ''
    })
    const result = await deleteAccount(accountId)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('归档')
  })

  it('没有流水的账户可以删除', async () => {
    const account = await createAccount({ name: '临时账户', type: 'other', initialBalanceCents: 0 })
    expect((await deleteAccount(account.id)).ok).toBe(true)
  })
})

describe('预算', () => {
  it('设置、读取与清除', async () => {
    await setBudget('2026-11', null, 300000)
    expect(await getBudget('2026-11', null)).toBe(300000)

    await setBudget('2026-11', 'food-id', 50000)
    expect(await getBudget('2026-11', 'food-id')).toBe(50000)

    await setBudget('2026-11', null, 0)
    expect(await getBudget('2026-11', null)).toBe(0)
  })
})

describe('界面风格设置', () => {
  it('默认皮肤为宣纸，可持久化', async () => {
    expect((await getSettings()).skin).toBe('ink')
    await setSetting('skin', 'mono')
    expect((await getSettings()).skin).toBe('mono')
  })

  it('未知皮肤回退为宣纸', async () => {
    await setSetting('skin', 'nope' as never)
    expect((await getSettings()).skin).toBe('ink')
  })
})
