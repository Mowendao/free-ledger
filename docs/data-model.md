# 数据模型

数据库：浏览器 IndexedDB，库名 `free-ledger`，由 Dexie 管理。
所有金额字段均为**整数分**（`amountCents`），所有日期为本地 `YYYY-MM-DD` 字符串，月份为 `YYYY-MM`。

## 表结构（schemaVersion 1）

### `accounts` 账户

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string (PK) | UUID |
| `name` | string | 账户名，≤ 12 字 |
| `type` | `cash` \| `bank` \| `credit` \| `alipay` \| `wechat` \| `other` | 决定图标与文案 |
| `initialBalanceCents` | int | 期初余额（分），≥ 0 |
| `archived` | boolean | 归档后不出现在记账选择器 |
| `sortOrder` | int | 展示排序 |
| `createdAt` | int | 毫秒时间戳 |

索引：`id, sortOrder, archived`。余额不落库，由期初 + 全部流水实时计算。

### `categories` 分类

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string (PK) | UUID |
| `kind` | `expense` \| `income` | 收入 / 支出 |
| `name` | string | 分类名，≤ 10 字 |
| `icon` | string | 内联图标 key（见 `src/services/icons.ts`） |
| `color` | string | 十六进制颜色 |
| `builtin` | boolean | 内置分类：可改不可删 |
| `archived` | boolean | 预留 |
| `sortOrder` | int | 展示排序 |
| `createdAt` | int | 毫秒时间戳 |

索引：`id, kind, sortOrder, archived`。

### `transactions` 流水

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string (PK) | UUID |
| `kind` | `expense` \| `income` \| `transfer` | 转账只记一行 |
| `amountCents` | int | > 0 且 ≤ 999,999,999（¥9,999,999.99） |
| `categoryId` | string \| null | 转账必须为 null；`null` 表示「未分类」（如微信账单导入） |
| `accountId` | string | 支出/收入账户；转账的转出账户 |
| `toAccountId` | string \| null | 仅转账使用，且 ≠ `accountId` |
| `date` | string | `YYYY-MM-DD`，必须是通过 `isValidDate` 校验的真实日期 |
| `note` | string | ≤ 100 字 |
| `createdAt` / `updatedAt` | int | 毫秒时间戳，合并导入用 `updatedAt` 决胜 |
| `deletedAt` | int \| null \| 缺省 | 软删除时间；有值表示在回收站，不参与列表、统计、余额与备份 |

索引：`id, date, kind, categoryId, accountId, [date+kind]`。

### `budgets` 预算

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string (PK) | `${month}:${categoryId ?? 'total'}`，天然幂等 |
| `month` | string | `YYYY-MM` |
| `categoryId` | string \| null | null 表示月度总预算 |
| `amountCents` | int | > 0；设置为 0 即删除 |
| `updatedAt` | int | 毫秒时间戳 |

索引：`id, month, categoryId`。

### `settings` 设置

键值表（`key` 为主键），当前键：

| key | 类型 | 默认值 |
|---|---|---|
| `theme` | `light` \| `dark` \| `system` | `system` |
| `currency` | string | `¥` |
| `lastBackupAt` | ISO 字符串 | `''` |

### `meta` 元信息

| key | 说明 |
|---|---|
| `seeded` | 是否已写入默认账户与分类 |
| `schemaVersion` | 数据库结构版本 |

## 不变量

1. 金额恒为整数分，且 > 0（流水的期初余额允许 0）。
2. 转账的 `categoryId` 为 null，`toAccountId` 非空且不等于 `accountId`。
3. 有流水的账户**只能归档不能删除**；内置或被引用的分类不能直接删除；被引用分类可指定同类型目标后迁移删除。
4. 流水引用的账户必须存在（导入时校验）。
5. 余额恒等式：`余额 = 期初 + 收入 − 支出 + 转入 − 转出`。
6. 删除数据必须二次确认。
7. `deletedAt` 非空的流水视为回收站数据：不计入余额/统计、不出现在列表与备份；30 天后自动清理。

## 迁移策略

- 结构变更：在 `src/db/schema.ts` 增加 `this.version(n).stores(...)`，并写 `upgrade()` 迁移函数。
- 备份格式变更：递增 `BACKUP_SCHEMA_VERSION`，`parseBackup` 会拒绝高于当前版本的备份。
- 导入永远在新事务中执行；覆盖导入失败时整批回滚。

## 默认数据

- 账户：现金、微信、支付宝、银行卡（期初 0）。
- 支出分类：餐饮、交通、购物、居住、娱乐、医疗、教育、通讯、人情、其他。
- 收入分类：工资、奖金、理财、红包、其他。

种子数据见 `src/db/seed.ts`。
