/* 数据库类型定义与 Dexie 实例。只有本模块直接依赖 Dexie，便于将来替换存储引擎。 */
import Dexie, { type EntityTable } from 'dexie'

export type TxKind = 'expense' | 'income' | 'transfer'
export type CategoryKind = 'expense' | 'income'
export type AccountType = 'cash' | 'bank' | 'credit' | 'alipay' | 'wechat' | 'other'

export interface Account {
  id: string
  name: string
  type: AccountType
  initialBalanceCents: number
  archived: boolean
  sortOrder: number
  createdAt: number
}

export interface Category {
  id: string
  kind: CategoryKind
  name: string
  icon: string
  color: string
  builtin: boolean
  archived: boolean
  sortOrder: number
  createdAt: number
}

export interface Transaction {
  id: string
  kind: TxKind
  amountCents: number
  categoryId: string | null
  accountId: string
  toAccountId: string | null
  date: string
  note: string
  createdAt: number
  updatedAt: number
  /** 软删除时间；有值表示在回收站，不再参与统计、列表与备份 */
  deletedAt?: number | null
}

export interface Budget {
  id: string
  month: string
  /** null 表示月度总预算 */
  categoryId: string | null
  amountCents: number
  updatedAt: number
}

export interface Setting {
  key: string
  value: unknown
}

export interface Meta {
  key: string
  value: unknown
}

export type SkinId = 'ink' | 'mono' | 'celadon' | 'kraft' | 'rose' | 'olive' | 'terminal'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  skin: SkinId
  currency: string
  lastBackupAt: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  skin: 'ink',
  currency: '¥',
  lastBackupAt: ''
}

class FreeLedgerDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>
  categories!: EntityTable<Category, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  budgets!: EntityTable<Budget, 'id'>
  settings!: EntityTable<Setting, 'key'>
  meta!: EntityTable<Meta, 'key'>

  constructor() {
    super('free-ledger')
    this.version(1).stores({
      accounts: 'id, sortOrder, archived',
      categories: 'id, kind, sortOrder, archived',
      transactions: 'id, date, kind, categoryId, accountId, [date+kind]',
      budgets: 'id, month, categoryId',
      settings: 'key',
      meta: 'key'
    })
  }
}

export const db = new FreeLedgerDB()
