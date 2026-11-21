# Free Ledger · 自由记账

[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-online-10b981.svg)](https://mowendao.github.io/free-ledger/)
[![PWA](https://img.shields.io/badge/PWA-offline--ready-0ea5e9.svg)](https://web.dev/progressive-web-apps/)
[![No Ads](https://img.shields.io/badge/ads-none-ef4444.svg)](#隐私承诺)
[![No Cloud](https://img.shields.io/badge/cloud-never-8b5cf6.svg)](#隐私承诺)

**Free Ledger** 是一款开源、免费、无广告、无会员、**数据只存本机**的手机记账应用。
交互参考「鲨鱼记账」的快速记账与「随手记」的明细/统计，但没有任何账号体系、云同步和付费墙。

> Free as in freedom, and free as in beer.

## 特性

- **快速记账**：支出 / 收入 / 转账，自绘数字键盘，3 次点击完成一笔记账。
- **明细清晰**：按月分组、按日小计、类型/分类/账户筛选、备注搜索。
- **统计分析**：月度收支汇总、分类占比环形图、近 6 个月趋势柱状图。
- **预算管理**：月度总预算 + 分类预算，进度条与超支提示。
- **账户体系**：现金 / 微信 / 支付宝 / 银行卡 / 信用卡，余额实时计算（含转账）。
- **分类自定义**：名称、图标、颜色全部可改，内置分类受保护。
- **数据自主**：JSON 全量备份（覆盖 / 合并导入）、CSV 导出、一键清空。
- **离线可用**：PWA 安装到主屏幕，断网也能完整使用。
- **深色模式**：浅色 / 深色 / 跟随系统。
- **零外部依赖请求**：不加载 CDN、字体、统计脚本，生产构建注入 CSP。

## 界面预览

<p align="center">
  <img src="docs/screenshots/record.png" width="200" alt="记一笔" />
  <img src="docs/screenshots/ledger.png" width="200" alt="收支明细" />
  <img src="docs/screenshots/stats.png" width="200" alt="统计分析" />
  <img src="docs/screenshots/me.png" width="200" alt="我的" />
</p>

> 以上为演示数据截图；实际数据只保存在你自己的设备上。

## 设计语言

宣纸底色、墨色宋体、朱砂印章：去掉渐变、阴影与高饱和色，用 1px 细线分栏，像一页安静的账簿。
分类色板取自赭石、花青、胭脂、藤黄、竹青等传统色；暗色主题为「墨夜」。详见 [docs/design.md](docs/design.md)。

## 隐私承诺

- 所有账目、账户、预算只保存在**本机浏览器的 IndexedDB** 中。
- 不注册账号、不连接服务器、不上传任何数据，运行期网络请求为零。
- 无广告、无会员、无内购、无第三方统计。
- 代码完全开源（MIT），可自行审计、自行构建、自行部署。

详细说明见 [docs/privacy.md](docs/privacy.md)。

> ⚠️ **重要**：Free Ledger 不保存任何数据副本。清除浏览器站点数据、卸载浏览器或更换设备都会导致本机账目丢失。
> 请定期在「我的 → 数据备份与导出」中导出 JSON 备份，并保存到自己的网盘或移动硬盘。

## 快速开始

**在线体验**：<https://mowendao.github.io/free-ledger/>（手机浏览器打开可添加到主屏幕）

环境要求：Node.js ≥ 20.19（推荐 22 / 24）。

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5173
npm run build      # 生产构建，输出到 dist/
npm run preview    # 本地预览生产构建
npm test           # 运行 Vitest 测试
npm run typecheck  # vue-tsc 类型检查
```

## 安装到手机

PWA 需要 **HTTPS**（或 localhost）才能注册 Service Worker 并安装：

1. 用手机浏览器打开部署好的 HTTPS 地址；
2. Android Chrome：菜单 →「添加到主屏幕 / 安装应用」；
3. iOS Safari：分享 →「添加到主屏幕」；
4. 之后从桌面图标启动，即可以独立窗口、离线运行。

局域网 `http://192.168.x.x:5173` 仅适合调试：可以浏览和记账，但无法安装与离线。

## 部署

### GitHub Pages（推荐）

仓库已内置 `.github/workflows/deploy.yml`：推送到 `main` 会自动：

1. `npm ci` → 运行测试 → 以 `BASE_URL=/free-ledger/` 构建；
2. 发布到 GitHub Pages（Settings → Pages → Source 选择 **GitHub Actions**）。

仓库地址：<https://github.com/Mowendao/free-ledger>

### 其他静态托管

`dist/` 是纯静态产物，可部署到任意静态托管（Vercel / Netlify / Cloudflare Pages / 自建 Nginx）。
部署在子路径时设置环境变量 `BASE_URL=/your-sub-path/` 再构建。

## 数据备份

导出的 JSON 结构稳定，便于长期保存与迁移：

```json
{
  "app": "free-ledger",
  "schemaVersion": 1,
  "exportedAt": "2026-11-21T02:00:00.000Z",
  "data": {
    "accounts": [],
    "categories": [],
    "transactions": [],
    "budgets": [],
    "settings": []
  }
}
```

- **覆盖导入**：清空当前数据后完整恢复，适合换机迁移。
- **合并导入**：保留现有数据，按 `id` 去重并保留更新时间较新的记录。
- 导入时会校验应用标识、版本、字段类型、日期与账户引用；非法文件会被拒绝，不会污染现有数据。

## 项目结构

```
.
├─ app/                    # 应用源码（Vite 工程）
│  ├─ src/
│  │  ├─ db/               # Dexie 实例、表结构、种子数据
│  │  ├─ repositories/     # 数据访问层（唯一直接操作 Dexie 的地方）
│  │  ├─ services/         # 金额、日期、统计、备份等纯逻辑
│  │  ├─ stores/           # Pinia 状态
│  │  ├─ components/       # 通用组件（键盘、图表、弹层…）
│  │  ├─ pages/            # 页面
│  │  └─ styles/           # 设计令牌与基础样式
│  └─ tests/               # Vitest 单元 / 组件 / 冒烟测试
├─ docs/                   # 架构、数据模型、隐私说明
└─ .github/workflows/      # CI 与 Pages 部署
```

更详细的分层与数据流见 [docs/architecture.md](docs/architecture.md)，
表结构与不变量见 [docs/data-model.md](docs/data-model.md)。

## 技术栈

Vue 3 · TypeScript · Vite 7 · vue-router（hash）· Pinia · Dexie 4（IndexedDB）·
vite-plugin-pwa · Vitest + jsdom。样式为手写 CSS 设计令牌，图表为自制 SVG，不引入 UI 库与图表库。

## 路线图

- [x] v0.1 核心记账、明细、账户、分类、预算、统计、备份、PWA
- [ ] 周期账单（房租 / 订阅自动记账）
- [ ] 多账本（日常 / 旅行 / 项目）
- [ ] 标签与多条件组合筛选
- [ ] Capacitor 打包 Android / iOS（复用同一套代码，本地 SQLite）
- [ ] 数据加密（可选口令）

## 参与贡献

欢迎 Issue 与 PR。提交前请确保 `npm test` 与 `npm run typecheck` 通过；
请保持「无广告、无会员、不联网、本地存储」的产品底线。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

[MIT](LICENSE) © 2026 Mowendao
