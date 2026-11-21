import { defineStore } from 'pinia'
import {
  DEFAULT_SETTINGS,
  type Account,
  type AppSettings,
  type Budget,
  type Category,
  type Transaction
} from '@/db/schema'
import { initDb } from '@/db/init'
import { accountBalances, listAllAccounts } from '@/repositories/accounts'
import { listCategories } from '@/repositories/categories'
import { monthTransactions } from '@/repositories/transactions'
import { listBudgets } from '@/repositories/budgets'
import { getSettings, setSetting } from '@/repositories/settings'
import { currentMonth } from '@/services/dates'
import { summarize } from '@/services/stats'

export const useLedgerStore = defineStore('ledger', {
  state: () => ({
    ready: false,
    month: currentMonth(),
    accounts: [] as Account[],
    categories: [] as Category[],
    transactions: [] as Transaction[],
    balances: {} as Record<string, number>,
    budgets: [] as Budget[],
    settings: { ...DEFAULT_SETTINGS } as AppSettings
  }),

  getters: {
    activeAccounts: (state) => state.accounts.filter((account) => !account.archived),
    expenseCategories: (state) =>
      state.categories.filter((category) => category.kind === 'expense' && !category.archived),
    incomeCategories: (state) =>
      state.categories.filter((category) => category.kind === 'income' && !category.archived),
    categoryById: (state) => (id: string | null | undefined) =>
      state.categories.find((category) => category.id === id),
    accountById: (state) => (id: string | null | undefined) =>
      state.accounts.find((account) => account.id === id),
    summary: (state) => summarize(state.transactions),
    totalAssets: (state) => Object.values(state.balances).reduce((sum, value) => sum + value, 0),
    totalBudget: (state) =>
      state.budgets.find((budget) => budget.categoryId === null)?.amountCents ?? 0
  },

  actions: {
    async bootstrap(): Promise<void> {
      await initDb()
      this.settings = await getSettings()
      await this.reloadAll()
      this.ready = true
    },

    async reloadAll(): Promise<void> {
      const [accounts, categories, balances, transactions, budgets] = await Promise.all([
        listAllAccounts(),
        listCategories(),
        accountBalances(),
        monthTransactions(this.month),
        listBudgets(this.month)
      ])
      this.accounts = accounts
      this.categories = categories
      this.balances = balances
      this.transactions = transactions
      this.budgets = budgets
    },

    async reloadBasics(): Promise<void> {
      const [accounts, categories, balances] = await Promise.all([
        listAllAccounts(),
        listCategories(),
        accountBalances()
      ])
      this.accounts = accounts
      this.categories = categories
      this.balances = balances
    },

    async reloadMonth(): Promise<void> {
      const [transactions, budgets, balances] = await Promise.all([
        monthTransactions(this.month),
        listBudgets(this.month),
        accountBalances()
      ])
      this.transactions = transactions
      this.budgets = budgets
      this.balances = balances
    },

    async setMonth(month: string): Promise<void> {
      this.month = month
      await this.reloadMonth()
    },

    async saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
      await setSetting(key, value)
      this.settings = { ...this.settings, [key]: value }
    },

    async refreshSettings(): Promise<void> {
      this.settings = await getSettings()
    }
  }
})
