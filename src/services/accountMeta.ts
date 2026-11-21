import type { AccountType } from '@/db/schema'

const ICON_BY_TYPE: Record<AccountType, string> = {
  cash: 'cash',
  bank: 'bank',
  credit: 'credit',
  alipay: 'alipay',
  wechat: 'wechat',
  other: 'wallet'
}

export function accountIcon(type: AccountType): string {
  return ICON_BY_TYPE[type] ?? 'wallet'
}

export const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: 'cash', label: '现金' },
  { value: 'wechat', label: '微信' },
  { value: 'alipay', label: '支付宝' },
  { value: 'bank', label: '银行卡' },
  { value: 'credit', label: '信用卡' },
  { value: 'other', label: '其他' }
]

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = ACCOUNT_TYPE_OPTIONS.reduce(
  (map, option) => ({ ...map, [option.value]: option.label }),
  {} as Record<AccountType, string>
)
