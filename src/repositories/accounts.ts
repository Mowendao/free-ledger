import { db, type Account, type AccountType } from '@/db/schema'
import { computeBalances } from '@/services/balances'

export interface AccountInput {
  name: string
  type: AccountType
  initialBalanceCents: number
}

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  const all = await db.accounts.orderBy('sortOrder').toArray()
  return includeArchived ? all : all.filter((a) => !a.archived)
}

export async function listAllAccounts(): Promise<Account[]> {
  return db.accounts.orderBy('sortOrder').toArray()
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return db.accounts.get(id)
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const name = input.name.trim()
  if (!name) throw new Error('账户名称不能为空')
  const maxSort = await db.accounts.orderBy('sortOrder').last()
  const account: Account = {
    id: crypto.randomUUID(),
    name,
    type: input.type,
    initialBalanceCents: Math.max(0, Math.round(input.initialBalanceCents)),
    archived: false,
    sortOrder: (maxSort?.sortOrder ?? -1) + 1,
    createdAt: Date.now()
  }
  await db.accounts.add(account)
  return account
}

export async function updateAccount(
  id: string,
  patch: Partial<Pick<Account, 'name' | 'type' | 'initialBalanceCents'>>
): Promise<void> {
  const data: Partial<Account> = { ...patch }
  if (typeof data.name === 'string') {
    data.name = data.name.trim()
    if (!data.name) throw new Error('账户名称不能为空')
  }
  if (typeof data.initialBalanceCents === 'number') {
    data.initialBalanceCents = Math.max(0, Math.round(data.initialBalanceCents))
  }
  await db.accounts.update(id, data)
}

export async function setAccountArchived(id: string, archived: boolean): Promise<void> {
  await db.accounts.update(id, { archived })
}

export async function countAccountUsage(id: string): Promise<number> {
  return db.transactions.where('accountId').equals(id).count()
}

/** 删除账户：有流水时拒绝，调用方应改为归档。 */
export async function deleteAccount(id: string): Promise<{ ok: boolean; reason?: string }> {
  const usage = await countAccountUsage(id)
  if (usage > 0) return { ok: false, reason: `该账户有 ${usage} 笔流水，只能归档` }
  await db.accounts.delete(id)
  return { ok: true }
}

export async function accountBalances(): Promise<Record<string, number>> {
  const [accounts, transactions] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray()
  ])
  return computeBalances(accounts, transactions)
}
