import { db, type Transaction, type TxKind } from '@/db/schema'
import { isValidDate, monthOf } from '@/services/dates'

export interface TxQuery {
  month?: string
  kind?: TxKind
  categoryId?: string | null
  accountId?: string
  keyword?: string
}

export interface TxInput {
  kind: TxKind
  amountCents: number
  categoryId: string | null
  accountId: string
  toAccountId: string | null
  date: string
  note: string
}

function validate(input: TxInput): void {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error('金额必须大于 0')
  }
  if (!isValidDate(input.date)) throw new Error('日期格式不正确')
  if (!input.accountId) throw new Error('请选择账户')
  if (input.kind === 'transfer') {
    if (!input.toAccountId) throw new Error('请选择转入账户')
    if (input.toAccountId === input.accountId) throw new Error('转出与转入账户不能相同')
  }
}

export async function listTransactions(query: TxQuery = {}): Promise<Transaction[]> {
  let rows: Transaction[]

  if (query.month) {
    rows = await db.transactions
      .where('date')
      .between(`${query.month}-01`, `${query.month}-31`, true, true)
      .toArray()
  } else {
    rows = await db.transactions.toArray()
  }

  const keyword = query.keyword?.trim().toLowerCase()
  rows = rows.filter((t) => !t.deletedAt)
  if (query.kind) rows = rows.filter((t) => t.kind === query.kind)
  if (query.categoryId !== undefined && query.categoryId !== null) {
    rows = rows.filter((t) => t.categoryId === query.categoryId)
  }
  if (query.accountId) rows = rows.filter((t) => t.accountId === query.accountId)
  if (keyword) {
    rows = rows.filter(
      (t) => t.note.toLowerCase().includes(keyword) || t.date.includes(keyword)
    )
  }

  return rows.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)))
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  const transaction = await db.transactions.get(id)
  return transaction && !transaction.deletedAt ? transaction : undefined
}

export async function createTransaction(input: TxInput): Promise<Transaction> {
  validate(input)
  const now = Date.now()
  const transaction: Transaction = {
    id: crypto.randomUUID(),
    kind: input.kind,
    amountCents: input.amountCents,
    categoryId: input.kind === 'transfer' ? null : input.categoryId,
    accountId: input.accountId,
    toAccountId: input.kind === 'transfer' ? input.toAccountId : null,
    date: input.date,
    note: input.note.trim().slice(0, 100),
    createdAt: now,
    updatedAt: now
  }
  await db.transactions.add(transaction)
  return transaction
}

export async function updateTransaction(id: string, input: TxInput): Promise<void> {
  validate(input)
  const existing = await db.transactions.get(id)
  if (!existing) throw new Error('记录不存在')
  await db.transactions.update(id, {
    kind: input.kind,
    amountCents: input.amountCents,
    categoryId: input.kind === 'transfer' ? null : input.categoryId,
    accountId: input.accountId,
    toAccountId: input.kind === 'transfer' ? input.toAccountId : null,
    date: input.date,
    note: input.note.trim().slice(0, 100),
    updatedAt: Date.now()
  })
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.update(id, { deletedAt: Date.now(), updatedAt: Date.now() })
}

/** 撤销删除：把流水从回收站恢复。 */
export async function restoreTransaction(id: string): Promise<void> {
  await db.transactions.update(id, { deletedAt: null, updatedAt: Date.now() })
}

export async function listAllTransactions(): Promise<Transaction[]> {
  return listTransactions()
}

/** 某月全部流水（用于统计页）。 */
export async function monthTransactions(month: string): Promise<Transaction[]> {
  return listTransactions({ month })
}

/** 最近 N 个月的流水，用于趋势图。 */
export async function transactionsSince(months: string[]): Promise<Transaction[]> {
  if (!months.length) return []
  const start = `${months[0]}-01`
  const last = months[months.length - 1]
  const end = `${last}-31`
  const rows = await db.transactions.where('date').between(start, end, true, true).toArray()
  return rows.filter((t) => !t.deletedAt)
}

export function monthOfTransaction(transaction: Transaction): string {
  return monthOf(transaction.date)
}
