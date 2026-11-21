import { db, type Category, type CategoryKind } from '@/db/schema'

export interface CategoryInput {
  kind: CategoryKind
  name: string
  icon: string
  color: string
}

export async function listCategories(kind?: CategoryKind): Promise<Category[]> {
  const all = kind
    ? await db.categories.where('kind').equals(kind).toArray()
    : await db.categories.toArray()
  return all.sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getCategory(id: string): Promise<Category | undefined> {
  return db.categories.get(id)
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const name = input.name.trim()
  if (!name) throw new Error('分类名称不能为空')
  const maxSort = await db.categories.orderBy('sortOrder').last()
  const category: Category = {
    id: crypto.randomUUID(),
    kind: input.kind,
    name,
    icon: input.icon || 'other',
    color: input.color || '#94a3b8',
    builtin: false,
    archived: false,
    sortOrder: (maxSort?.sortOrder ?? -1) + 1,
    createdAt: Date.now()
  }
  await db.categories.add(category)
  return category
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'icon' | 'color' | 'archived'>>
): Promise<void> {
  const data: Partial<Category> = { ...patch }
  if (typeof data.name === 'string') {
    data.name = data.name.trim()
    if (!data.name) throw new Error('分类名称不能为空')
  }
  await db.categories.update(id, data)
}

export async function countCategoryUsage(id: string): Promise<number> {
  const rows = await db.transactions.where('categoryId').equals(id).toArray()
  return rows.filter((transaction) => !transaction.deletedAt).length
}

/** 删除分类：内置分类拒绝；被引用时可选择迁移到同类型分类后删除。 */
export async function deleteCategory(
  id: string,
  targetCategoryId?: string | null
): Promise<{ ok: boolean; reason?: string }> {
  const category = await db.categories.get(id)
  if (!category) return { ok: false, reason: '分类不存在' }
  if (category.builtin) return { ok: false, reason: '内置分类不可删除' }

  const usage = await countCategoryUsage(id)
  if (usage === 0) {
    await db.categories.delete(id)
    return { ok: true }
  }

  if (!targetCategoryId) {
    return { ok: false, reason: `该分类有 ${usage} 笔流水，请选择迁移目标` }
  }

  const target = await db.categories.get(targetCategoryId)
  if (!target || target.id === id) return { ok: false, reason: '迁移目标无效' }
  if (target.kind !== category.kind) return { ok: false, reason: '只能迁移到同类型分类' }

  await db.transaction('rw', db.transactions, db.categories, async () => {
    const rows = await db.transactions.where('categoryId').equals(id).toArray()
    const now = Date.now()
    for (const row of rows) {
      await db.transactions.update(row.id, { categoryId: target.id, updatedAt: now })
    }
    await db.categories.delete(id)
  })

  return { ok: true }
}
