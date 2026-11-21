/* 金额工具：数据库一律存整数分，展示时格式化为元。 */

export const MAX_AMOUNT_CENTS = 999_999_999 // ¥9,999,999.99

/** 解析用户输入（元）为整数分，非法输入返回 0，超上限截断。 */
export function parseCents(text: string): number {
  const cleaned = String(text ?? '')
    .replace(/[,\s¥￥$€]/g, '')
    .trim()
  if (!cleaned) return 0
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(Math.round(value * 100), MAX_AMOUNT_CENTS)
}

/** 分 → 带千分位的金额字符串，如 123456 → "1,234.56"。 */
export function formatCents(cents: number): string {
  const rounded = Math.round(cents)
  const negative = rounded < 0
  const abs = Math.abs(rounded)
  const yuan = Math.floor(abs / 100)
  const fen = abs % 100
  const yuanText = String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${yuanText}.${String(fen).padStart(2, '0')}`
}

/** 分 → 金额输入框文本（尽量短），如 1250 → "12.5"，1200 → "12"。 */
export function toAmountInput(cents: number): string {
  const abs = Math.abs(Math.round(cents))
  const yuan = Math.floor(abs / 100)
  const fen = abs % 100
  if (fen === 0) return String(yuan)
  if (fen % 10 === 0) return `${yuan}.${fen / 10}`
  return `${yuan}.${String(fen).padStart(2, '0')}`
}

/** 给金额加货币符号。 */
export function formatMoney(cents: number, currency = '¥'): string {
  return `${currency}${formatCents(cents)}`
}
