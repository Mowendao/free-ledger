import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/schema'
import { resetDb } from '@/db/init'
import { createTransaction } from '@/repositories/transactions'
import { deleteTransaction } from '@/repositories/transactions'
import { getSettings, setSetting } from '@/repositories/settings'
import {
  buildBackup,
  buildCsv,
  getDataStats,
  mergeWithBackup,
  parseBackup,
  replaceWithBackup,
  serializeBackup
} from '@/services/backup'

beforeEach(async () => {
  await resetDb()
})

async function seedTransaction(): Promise<string> {
  const accounts = await db.accounts.toArray()
  const categories = await db.categories.where('kind').equals('expense').toArray()
  const transaction = await createTransaction({
    kind: 'expense',
    amountCents: 2350,
    categoryId: categories[0].id,
    accountId: accounts[0].id,
    toAccountId: null,
    date: '2026-11-21',
    note: '午餐'
  })
  return transaction.id
}

describe('备份往返', () => {
  it('导出后再解析，数据一致', async () => {
    await seedTransaction()
    const backup = await buildBackup()
    const parsed = parseBackup(serializeBackup(backup))

    expect(parsed.app).toBe('free-ledger')
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.data.transactions).toHaveLength(1)
    expect(parsed.data.accounts.length).toBeGreaterThan(0)
    expect(parsed.data.categories.length).toBeGreaterThan(0)
    expect(parsed.data.transactions[0].amountCents).toBe(2350)
  })

  it('覆盖导入能完整恢复', async () => {
    const id = await seedTransaction()
    const backup = parseBackup(serializeBackup(await buildBackup()))

    await db.transactions.clear()
    expect(await db.transactions.count()).toBe(0)

    const result = await replaceWithBackup(backup)
    const restored = await db.transactions.get(id)
    expect(result.imported).toBe(1)
    expect(restored?.amountCents).toBe(2350)
    expect(restored?.note).toBe('午餐')
  })

  it('合并导入按 id 去重', async () => {
    await seedTransaction()
    const backup = parseBackup(serializeBackup(await buildBackup()))

    const result = await mergeWithBackup(backup)
    expect(result.imported).toBe(0)
    expect(result.skipped).toBeGreaterThan(0)
  })

  it('合并导入只补充新记录', async () => {
    await seedTransaction()
    const backup = parseBackup(serializeBackup(await buildBackup()))

    await db.transactions.clear()
    const first = await mergeWithBackup(backup)
    expect(first.imported).toBeGreaterThan(0)
    const second = await mergeWithBackup(backup)
    expect(second.imported).toBe(0)
  })

  it('设置随备份恢复', async () => {
    await setSetting('theme', 'dark')
    expect((await getSettings()).theme).toBe('dark')
    const backup = parseBackup(serializeBackup(await buildBackup()))

    await setSetting('theme', 'light')
    await replaceWithBackup(backup)
    expect((await getSettings()).theme).toBe('dark')
  })

  it('回收站中的流水不进入备份与统计', async () => {
    const id = await seedTransaction()
    await deleteTransaction(id)
    const backup = await buildBackup()
    expect(backup.data.transactions).toHaveLength(0)
    expect((await getDataStats()).transactions).toBe(0)
  })

  it('界面风格随备份恢复', async () => {
    await setSetting('skin', 'kraft')
    const backup = parseBackup(serializeBackup(await buildBackup()))

    await setSetting('skin', 'ink')
    await replaceWithBackup(backup)
    expect((await getSettings()).skin).toBe('kraft')
  })
})

describe('备份校验', () => {
  it('拒绝非 JSON', () => {
    expect(() => parseBackup('not json')).toThrow('不是有效的 JSON')
  })

  it('拒绝其他应用的备份', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'other', schemaVersion: 1, data: {} }))).toThrow(
      '不是 Free Ledger'
    )
  })

  it('拒绝更高的备份版本', () => {
    expect(() =>
      parseBackup(JSON.stringify({ app: 'free-ledger', schemaVersion: 99, data: {} }))
    ).toThrow('备份版本不受支持')
  })

  it('拒绝版本 0', () => {
    expect(() =>
      parseBackup(JSON.stringify({ app: 'free-ledger', schemaVersion: 0, data: {} }))
    ).toThrow('备份版本不受支持')
  })

  it('拒绝金额为 0 的流水', async () => {
    await seedTransaction()
    const raw = JSON.parse(serializeBackup(await buildBackup()))
    raw.data.transactions[0].amountCents = 0
    expect(() => parseBackup(JSON.stringify(raw))).toThrow('流水金额')
  })

  it('拒绝引用不存在账户的流水', async () => {
    await seedTransaction()
    const raw = JSON.parse(serializeBackup(await buildBackup()))
    raw.data.accounts = []
    expect(() => parseBackup(JSON.stringify(raw))).toThrow('不存在的账户')
  })

  it('拒绝非法日期', async () => {
    await seedTransaction()
    const raw = JSON.parse(serializeBackup(await buildBackup()))
    raw.data.transactions[0].date = '2026-02-30'
    expect(() => parseBackup(JSON.stringify(raw))).toThrow('流水日期无效')
  })
})

describe('导入容错', () => {
  it('同一 id 的重复记录按 updatedAt 去重', async () => {
    await seedTransaction()
    const raw = JSON.parse(serializeBackup(await buildBackup()))
    const original = raw.data.transactions[0]
    raw.data.transactions.push({
      ...original,
      amountCents: 9999,
      updatedAt: original.updatedAt + 1000
    })

    const parsed = parseBackup(JSON.stringify(raw))
    expect(parsed.data.transactions).toHaveLength(1)
    expect(parsed.data.transactions[0].amountCents).toBe(9999)
  })

  it('拒绝引用不存在分类的流水', async () => {
    await seedTransaction()
    const raw = JSON.parse(serializeBackup(await buildBackup()))
    raw.data.transactions[0].categoryId = 'missing-category'
    expect(() => parseBackup(JSON.stringify(raw))).toThrow('不存在的分类')
  })

  it('汇总多处格式错误', async () => {
    await seedTransaction()
    const raw = JSON.parse(serializeBackup(await buildBackup()))
    raw.data.transactions.push({ ...raw.data.transactions[0], id: 'bad-1', amountCents: 0 })
    raw.data.transactions.push({ ...raw.data.transactions[0], id: 'bad-2', date: '2026-02-30' })
    expect(() => parseBackup(JSON.stringify(raw))).toThrow(/备份有 2 处错误/)
  })
})

describe('CSV 导出', () => {
  it('带 BOM、表头与转义', async () => {
    const accounts = await db.accounts.toArray()
    const categories = await db.categories.where('kind').equals('expense').toArray()
    await createTransaction({
      kind: 'expense',
      amountCents: 1234,
      categoryId: categories[0].id,
      accountId: accounts[0].id,
      toAccountId: null,
      date: '2026-11-21',
      note: '含,逗号与"引号"'
    })

    const csv = await buildCsv()
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('日期,类型,分类,账户,金额(元),备注')
    expect(csv).toContain('12.34')
    expect(csv).toContain('"含,逗号与""引号"""')
  })
})
