/* 初始化数据库：首次打开时写入默认账户、分类与设置。幂等。 */
import { db } from './schema'
import { buildAccountSeeds, buildCategorySeeds } from './seed'
import { DEFAULT_SETTINGS } from './schema'

export async function initDb(): Promise<void> {
  await db.open()
  const seeded = await db.meta.get('seeded')
  if (seeded) return

  await db.transaction('rw', db.categories, db.accounts, db.settings, db.meta, async () => {
    if (await db.meta.get('seeded')) return
    await db.categories.bulkAdd(buildCategorySeeds())
    await db.accounts.bulkAdd(buildAccountSeeds())
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await db.settings.put({ key, value })
    }
    await db.meta.put({ key: 'seeded', value: 1 })
    await db.meta.put({ key: 'schemaVersion', value: 1 })
  })
}

/** 仅供测试：清空并重建数据库。 */
export async function resetDb(): Promise<void> {
  await db.delete()
  await db.open()
  await initDb()
}
