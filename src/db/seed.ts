import type { Account, Category, CategoryKind } from './schema'

export interface CategorySeed {
  kind: CategoryKind
  name: string
  icon: string
  color: string
}

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  { kind: 'expense', name: '餐饮', icon: 'food', color: '#9c5a3c' },
  { kind: 'expense', name: '交通', icon: 'transport', color: '#3f6f7f' },
  { kind: 'expense', name: '购物', icon: 'shopping', color: '#a3445a' },
  { kind: 'expense', name: '居住', icon: 'home', color: '#3f4d56' },
  { kind: 'expense', name: '娱乐', icon: 'fun', color: '#b8892f' },
  { kind: 'expense', name: '医疗', icon: 'medical', color: '#a63a2e' },
  { kind: 'expense', name: '教育', icon: 'edu', color: '#5c7a5f' },
  { kind: 'expense', name: '通讯', icon: 'phone', color: '#3b5a7a' },
  { kind: 'expense', name: '人情', icon: 'gift', color: '#7d3b4a' },
  { kind: 'expense', name: '其他', icon: 'other', color: '#8a8478' },
  { kind: 'income', name: '工资', icon: 'salary', color: '#4f6f52' },
  { kind: 'income', name: '奖金', icon: 'bonus', color: '#a8823a' },
  { kind: 'income', name: '理财', icon: 'invest', color: '#3f6f7f' },
  { kind: 'income', name: '红包', icon: 'redpacket', color: '#a63a2e' },
  { kind: 'income', name: '其他', icon: 'other', color: '#8a8478' }
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
