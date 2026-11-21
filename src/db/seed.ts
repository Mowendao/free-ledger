import type { Account, Category, CategoryKind } from './schema'

export interface CategorySeed {
  kind: CategoryKind
  name: string
  icon: string
  color: string
}

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  { kind: 'expense', name: '餐饮', icon: 'food', color: '#f97316' },
  { kind: 'expense', name: '交通', icon: 'transport', color: '#3b82f6' },
  { kind: 'expense', name: '购物', icon: 'shopping', color: '#ec4899' },
  { kind: 'expense', name: '居住', icon: 'home', color: '#8b5cf6' },
  { kind: 'expense', name: '娱乐', icon: 'fun', color: '#f59e0b' },
  { kind: 'expense', name: '医疗', icon: 'medical', color: '#ef4444' },
  { kind: 'expense', name: '教育', icon: 'edu', color: '#14b8a6' },
  { kind: 'expense', name: '通讯', icon: 'phone', color: '#6366f1' },
  { kind: 'expense', name: '人情', icon: 'gift', color: '#f43f5e' },
  { kind: 'expense', name: '其他', icon: 'other', color: '#94a3b8' },
  { kind: 'income', name: '工资', icon: 'salary', color: '#10b981' },
  { kind: 'income', name: '奖金', icon: 'bonus', color: '#22c55e' },
  { kind: 'income', name: '理财', icon: 'invest', color: '#0ea5e9' },
  { kind: 'income', name: '红包', icon: 'redpacket', color: '#f43f5e' },
  { kind: 'income', name: '其他', icon: 'other', color: '#94a3b8' }
]

export const DEFAULT_ACCOUNTS: Array<Pick<Account, 'name' | 'type'>> = [
  { name: '现金', type: 'cash' },
  { name: '微信', type: 'wechat' },
  { name: '支付宝', type: 'alipay' },
  { name: '银行卡', type: 'bank' }
]

export function buildCategorySeeds(): Category[] {
  return DEFAULT_CATEGORIES.map((c, index) => ({
    id: crypto.randomUUID(),
    kind: c.kind,
    name: c.name,
    icon: c.icon,
    color: c.color,
    builtin: true,
    archived: false,
    sortOrder: index,
    createdAt: Date.now()
  }))
}

export function buildAccountSeeds(): Account[] {
  return DEFAULT_ACCOUNTS.map((a, index) => ({
    id: crypto.randomUUID(),
    name: a.name,
    type: a.type,
    initialBalanceCents: 0,
    archived: false,
    sortOrder: index,
    createdAt: Date.now()
  }))
}
