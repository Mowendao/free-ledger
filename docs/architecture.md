# 架构说明

## 总览

Free Ledger 是纯前端静态应用，没有后端。浏览器即数据库与运行时，所有数据落在 IndexedDB。

```
页面 / 组件  →  Pinia Store  →  Repository 层  →  Dexie (IndexedDB)
                                    ↑
                               Services（纯函数）
```

## 分层职责

| 层 | 位置 | 职责 | 约束 |
|---|---|---|---|
| 页面 | `src/pages/` | 交互、表单状态、校验提示 | 不直接操作 Dexie |
| 组件 | `src/components/` | 可复用 UI（键盘、图表、弹层…） | 无业务副作用 |
| Store | `src/stores/useLedger.ts` | 当前月份、账户、分类、流水、余额、设置 | 只调用 Repository |
| Repository | `src/repositories/` | 增删改查、业务守卫（内置分类保护、账户引用检查） | 唯一直接调用 Dexie 的层 |
| Services | `src/services/` | 金额、日期、统计、余额、备份、提示 | 纯函数优先，便于测试 |
| DB | `src/db/` | 表结构、索引、种子数据、初始化 | 不包含 UI 逻辑 |

**替换存储引擎**：将来用 Capacitor 打包原生应用时，只需替换 `src/db/` 与 `src/repositories/`，
页面与 Store 的接口不变（Repository 全部返回 Promise）。

## 关键决策

1. **金额用整数分**：避免 `0.1 + 0.2` 浮点误差；展示时统一用 `formatCents`。
2. **日期用本地 `YYYY-MM-DD` 字符串**：不做 UTC 转换，避免"晚上 23:30 记的账跑到第二天"。
3. **Hash 路由**：静态托管无需 404 重写，GitHub Pages / 任意子路径开箱即用。
4. **手写 CSS + 自制 SVG 图表**：不引入 UI 库与 ECharts，包体更小、离线更可靠、无供应链风险。
5. **PWA 而非首版 APK**：无需 Android SDK 即可在手机安装使用；后续用 Capacitor 复用同一套代码。
6. **生产构建注入 CSP**：`default-src 'self'` 等策略限制外部资源，配合"代码里不写网络请求"形成双保险。
7. **备份格式独立版本号**：`schemaVersion` 与数据库迁移版本解耦，导入时校验并拒绝过新版本。

## 数据流示例：记一笔

1. `RecordPage` 收集类型、金额（分）、分类、账户、日期、备注；
2. 调用 `createTransaction()`：校验金额 > 0、日期合法、转账账户不同；
3. Repository 写入 `transactions` 表；
4. `store.reloadAll()` 重新读取账户、分类、当月流水与实时余额；
5. 页面显示 Toast，明细/统计页因共享 Store 自动更新。

## 余额恒等式

```
账户余额 = 期初余额 + 收入 − 支出 + 转入 − 转出
```

由 `src/services/balances.ts` 的纯函数 `computeBalances` 计算，测试覆盖支出、收入、转账、负余额与未知账户。

## 离线与更新

- `vite-plugin-pwa` 生成 Service Worker，预缓存应用壳（JS / CSS / HTML / 图标）。
- 更新策略为 `autoUpdate`：新版本发布后，下次打开自动拉取并刷新缓存。
- 应用无运行时接口请求，因此离线与在线行为一致。
