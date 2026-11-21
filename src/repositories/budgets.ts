import { db, type Budget } from '@/db/schema'

export function budgetId(month: string, categoryId: string | null): string {
  return `${month}:${categoryId ?? 'total'}`
}

export async function listBudgets(month: string): Promise<Budget[]> {
  return db.budgets.where('month').equals(month).toArray()
}

export async function getTotalBudget(month: string): Promise<Budget | undefined> {
  return db.budgets.get(budgetId(month, null))
}

/** 设置预算；金额 ≤ 0 视为删除。 */
export async function setBudget(
  month: string,
  categoryId: string | null,
  amountCents: number
): Promise<void> {
  const id = budgetId(month, categoryId)
  if (amountCents <= 0) {
    await db.budgets.delete(id)
    return
  }
  await db.budgets.put({
    id,
    month,
    categoryId,
    amountCents: Math.round(amountCents),
    updatedAt: Date.now()
  })
}

export async function getBudget(month: string, categoryId: string | null): Promise<number> {
  const row = await db.budgets.get(budgetId(month, categoryId))
  return row?.amountCents ?? 0
}
