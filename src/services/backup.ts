/* 备份与导入导出：JSON 全量备份 + CSV 导出。所有校验都在本地完成。 */
import {
  db,
  type Account,
  type AccountType,
  type Budget,
  type Category,
  type CategoryKind,
  type Setting,
  type Transaction,
  type TxKind
} from '@/db/schema'
import { formatCents, MAX_AMOUNT_CENTS } from './money'
import { isValidDate, isValidMonth } from './dates'
import { initDb } from '@/db/init'

export const BACKUP_APP = 'free-ledger'
export const BACKUP_SCHEMA_VERSION = 1
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024

export interface BackupData {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  settings: Setting[]
}

export interface BackupFile {
  app: string
  schemaVersion: number
  exportedAt: string
  data: BackupData
}

export interface ImportResult {
  imported: number
  skipped: number
}

const ACCOUNT_TYPES = new Set<AccountType>(['cash', 'bank', 'credit', 'alipay', 'wechat', 'other'])
const TX_KINDS = new Set<TxKind>(['expense', 'income', 'transfer'])
const CATEGORY_KINDS = new Set<CategoryKind>(['expense', 'income'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function needString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} 缺失或格式错误`)
  return value
}

function needInt(value: unknown, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${field} 必须是有效整数`)
  }
  return value
}

function parseAccount(raw: unknown, index: number): Account {
  if (!isRecord(raw)) throw new Error(`第 ${index + 1} 个账户格式错误`)
  const type = raw.type as AccountType
  if (!ACCOUNT_TYPES.has(type)) throw new Error(`账户类型无效：${String(raw.type)}`)
  return {
    id: needString(raw.id, '账户 id'),
    name: needString(raw.name, '账户名称'),
    type,
    initialBalanceCents: needInt(raw.initialBalanceCents ?? 0, '账户期初余额'),
    archived: Boolean(raw.archived),
    sortOrder: needInt(raw.sortOrder ?? index, '账户排序'),
    createdAt: needInt(raw.createdAt ?? Date.now(), '账户创建时间')
  }
}

function parseCategory(raw: unknown, index: number): Category {
  if (!isRecord(raw)) throw new Error(`第 ${index + 1} 个分类格式错误`)
  const kind = raw.kind as CategoryKind
  if (!CATEGORY_KINDS.has(kind)) throw new Error(`分类类型无效：${String(raw.kind)}`)
  return {
    id: needString(raw.id, '分类 id'),
    kind,
    name: needString(raw.name, '分类名称'),
    icon: typeof raw.icon === 'string' ? raw.icon : 'other',
    color: typeof raw.color === 'string' ? raw.color : '#94a3b8',
    builtin: Boolean(raw.builtin),
    archived: Boolean(raw.archived),
    sortOrder: needInt(raw.sortOrder ?? index, '分类排序'),
    createdAt: needInt(raw.createdAt ?? Date.now(), '分类创建时间')
  }
}

function parseTransaction(raw: unknown, index: number): Transaction {
  if (!isRecord(raw)) throw new Error(`第 ${index + 1} 笔流水格式错误`)
  const kind = raw.kind as TxKind
  if (!TX_KINDS.has(kind)) throw new Error(`流水类型无效：${String(raw.kind)}`)
  const date = needString(raw.date, '流水日期')
  if (!isValidDate(date)) throw new Error(`流水日期无效：${date}`)
  return {
    id: needString(raw.id, '流水 id'),
    kind,
    amountCents: needInt(raw.amountCents, '流水金额', 1, MAX_AMOUNT_CENTS),
    categoryId: typeof raw.categoryId === 'string' ? raw.categoryId : null,
    accountId: needString(raw.accountId, '流水账户'),
    toAccountId: typeof raw.toAccountId === 'string' ? raw.toAccountId : null,
    date,
    note: typeof raw.note === 'string' ? raw.note.slice(0, 100) : '',
    createdAt: needInt(raw.createdAt ?? Date.now(), '流水创建时间'),
    updatedAt: needInt(raw.updatedAt ?? Date.now(), '流水更新时间'),
    deletedAt: typeof raw.deletedAt === 'number' ? raw.deletedAt : null
  }
}

function parseBudget(raw: unknown, index: number): Budget {
  if (!isRecord(raw)) throw new Error(`第 ${index + 1} 条预算格式错误`)
  const month = needString(raw.month, '预算月份')
  if (!isValidMonth(month)) throw new Error(`预算月份无效：${month}`)
  return {
    id: needString(raw.id, '预算 id'),
    month,
    categoryId: typeof raw.categoryId === 'string' ? raw.categoryId : null,
    amountCents: needInt(raw.amountCents, '预算金额', 1, MAX_AMOUNT_CENTS),
    updatedAt: needInt(raw.updatedAt ?? Date.now(), '预算更新时间')
  }
}

function parseSetting(raw: unknown, index: number): Setting {
  if (!isRecord(raw)) throw new Error(`第 ${index + 1} 条设置格式错误`)
  return { key: needString(raw.key, '设置键'), value: raw.value ?? null }
}

export async function buildBackup(): Promise<BackupFile> {
  const [accounts, categories, transactions, budgets, settings] = await Promise.all([
    db.accounts.toArray(),
    db.categories.toArray(),
    db.transactions.filter((transaction) => !transaction.deletedAt).toArray(),
    db.budgets.toArray(),
    db.settings.toArray()
  ])
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { accounts, categories, transactions, budgets, settings }
  }
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2)
}

export function parseBackup(text: string): BackupFile {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('备份文件超过 10MB，已拒绝')
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('不是有效的 JSON 文件')
  }
  if (!isRecord(json)) throw new Error('备份文件结构不正确')
  if (json.app !== BACKUP_APP) throw new Error('不是 Free Ledger 的备份文件')
  if (
    typeof json.schemaVersion !== 'number' ||
    !Number.isInteger(json.schemaVersion) ||
    json.schemaVersion < 1 ||
    json.schemaVersion > BACKUP_SCHEMA_VERSION
  ) {
    throw new Error('备份版本不受支持，请使用当前版本导出的备份')
  }
  if (!isRecord(json.data)) throw new Error('备份数据缺失')

  const data = json.data
  const accounts = Array.isArray(data.accounts) ? data.accounts : []
  const categories = Array.isArray(data.categories) ? data.categories : []
  const transactions = Array.isArray(data.transactions) ? data.transactions : []
  const budgets = Array.isArray(data.budgets) ? data.budgets : []
  const settings = Array.isArray(data.settings) ? data.settings : []

  const parsedAccounts = collect(accounts, parseAccount, '账户')
  const parsedCategories = collect(categories, parseCategory, '分类')
  const parsedTransactions = collect(transactions, parseTransaction, '流水')
  const parsedBudgets = collect(budgets, parseBudget, '预算')
  const parsedSettings = collect(settings, parseSetting, '设置')

  const uniqueAccounts = dedupeById(parsedAccounts)
  const uniqueCategories = dedupeById(parsedCategories)
  const uniqueTransactions = dedupeById(parsedTransactions)
  const uniqueBudgets = dedupeById(parsedBudgets)
  const uniqueSettings = dedupeByKey(parsedSettings)

  const accountIds = new Set(uniqueAccounts.map((account) => account.id))
  const categoryIds = new Set(uniqueCategories.map((category) => category.id))

  for (const transaction of uniqueTransactions) {
    if (!accountIds.has(transaction.accountId)) {
      throw new Error(`流水 ${transaction.id} 引用了不存在的账户`)
    }
    if (transaction.categoryId && !categoryIds.has(transaction.categoryId)) {
      throw new Error(`流水 ${transaction.id} 引用了不存在的分类`)
    }
  }
  for (const budget of uniqueBudgets) {
    if (budget.categoryId && !categoryIds.has(budget.categoryId)) {
      throw new Error(`预算 ${budget.id} 引用了不存在的分类`)
    }
  }

  return {
    app: BACKUP_APP,
    schemaVersion: json.schemaVersion,
    exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : new Date().toISOString(),
    data: {
      accounts: uniqueAccounts,
      categories: uniqueCategories,
      transactions: uniqueTransactions,
      budgets: uniqueBudgets,
      settings: uniqueSettings
    }
  }
}

/** 逐条解析并汇总错误，避免只报第一条就中断。 */
function collect<T>(
  items: unknown[],
  parser: (raw: unknown, index: number) => T,
  label: string
): T[] {
  const results: T[] = []
  const errors: string[] = []

  items.forEach((raw, index) => {
    try {
      results.push(parser(raw, index))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${label}：${message}`)
    }
  })

  if (errors.length > 0) {
    const head = errors.slice(0, 3).join('；')
    const rest = errors.length > 3 ? `；另有 ${errors.length - 3} 处错误` : ''
    throw new Error(`备份有 ${errors.length} 处错误：${head}${rest}`)
  }

  return results
}

function dedupeById<T extends { id: string; updatedAt?: number }>(rows: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    const existing = map.get(row.id)
    if (!existing || (row.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) map.set(row.id, row)
  }
  return [...map.values()]
}

function dedupeByKey(rows: Setting[]): Setting[] {
  const map = new Map<string, Setting>()
  for (const row of rows) map.set(row.key, row)
  return [...map.values()]
}

/** 覆盖导入：清空现有数据后整体恢复。 */
export async function replaceWithBackup(backup: BackupFile): Promise<ImportResult> {
  const data = backup.data
  const accounts = dedupeById(data.accounts)
  const categories = dedupeById(data.categories)
  const transactions = dedupeById(data.transactions)
  const budgets = dedupeById(data.budgets)
  const settings = dedupeByKey(data.settings)

  await db.transaction(
    'rw',
    [db.accounts, db.categories, db.transactions, db.budgets, db.settings],
    async () => {
      await db.transactions.clear()
      await db.budgets.clear()
      await db.accounts.clear()
      await db.categories.clear()
      await db.settings.clear()
      await db.accounts.bulkAdd(accounts)
      await db.categories.bulkAdd(categories)
      await db.transactions.bulkAdd(transactions)
      await db.budgets.bulkAdd(budgets)
      await db.settings.bulkAdd(settings)
    }
  )
  await db.meta.put({ key: 'seeded', value: 1 })
  return { imported: transactions.length, skipped: 0 }
}

/** 合并导入：按 id 去重，更新时间较新的记录胜出。 */
export async function mergeWithBackup(backup: BackupFile): Promise<ImportResult> {
  const data = backup.data
  let imported = 0
  let skipped = 0

  await db.transaction(
    'rw',
    [db.accounts, db.categories, db.transactions, db.budgets, db.settings],
    async () => {
      for (const account of dedupeById(data.accounts)) {
        const existing = await db.accounts.get(account.id)
        if (!existing) {
          await db.accounts.add(account)
          imported++
        } else {
          skipped++
        }
      }
      for (const category of dedupeById(data.categories)) {
        const existing = await db.categories.get(category.id)
        if (!existing) {
          await db.categories.add(category)
          imported++
        } else {
          skipped++
        }
      }
      for (const tx of dedupeById(data.transactions)) {
        const existing = await db.transactions.get(tx.id)
        if (!existing || tx.updatedAt > existing.updatedAt) {
          await db.transactions.put(tx)
          imported++
        } else {
          skipped++
        }
      }
      for (const budget of dedupeById(data.budgets)) {
        const existing = await db.budgets.get(budget.id)
        if (!existing || budget.updatedAt > existing.updatedAt) {
          await db.budgets.put(budget)
          imported++
        } else {
          skipped++
        }
      }
      for (const setting of data.settings) {
        const existing = await db.settings.get(setting.key)
        if (!existing) {
          await db.settings.put(setting)
          imported++
        } else {
          skipped++
        }
      }
    }
  )

  return { imported, skipped }
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** 导出 CSV：带 BOM，Excel 直接打开不乱码。 */
export async function buildCsv(): Promise<string> {
  const [transactions, categories, accounts] = await Promise.all([
    db.transactions.filter((transaction) => !transaction.deletedAt).toArray(),
    db.categories.toArray(),
    db.accounts.toArray()
  ])
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const accountName = new Map(accounts.map((a) => [a.id, a.name]))

  const rows = transactions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)

  const lines = ['日期,类型,分类,账户,金额(元),备注']
  for (const tx of rows) {
    const kind = tx.kind === 'expense' ? '支出' : tx.kind === 'income' ? '收入' : '转账'
    const category = tx.kind === 'transfer' ? '转账' : categoryName.get(tx.categoryId ?? '') ?? '未分类'
    const account =
      tx.kind === 'transfer'
        ? `${accountName.get(tx.accountId) ?? '未知'} → ${accountName.get(tx.toAccountId ?? '') ?? '未知'}`
        : accountName.get(tx.accountId) ?? '未知'
    lines.push(
      [
        tx.date,
        kind,
        csvEscape(category),
        csvEscape(account),
        formatCents(tx.amountCents).replace(/,/g, ''),
        csvEscape(tx.note)
      ].join(',')
    )
  }
  return '\uFEFF' + lines.join('\r\n')
}

export interface DataStats {
  transactions: number
  accounts: number
  categories: number
  budgets: number
  firstDate: string | null
  lastDate: string | null
}

export async function getDataStats(): Promise<DataStats> {
  const [transactions, accounts, categories, budgets] = await Promise.all([
    db.transactions.filter((transaction) => !transaction.deletedAt).toArray(),
    db.accounts.count(),
    db.categories.count(),
    db.budgets.count()
  ])
  const sorted = transactions.slice().sort((a, b) => a.date.localeCompare(b.date))
  return {
    transactions: transactions.length,
    accounts,
    categories,
    budgets,
    firstDate: sorted[0]?.date ?? null,
    lastDate: sorted[sorted.length - 1]?.date ?? null
  }
}

/** 清空全部数据并恢复默认账户/分类。 */
export async function clearAllData(): Promise<void> {
  await db.delete()
  await db.open()
  await initDb()
}
