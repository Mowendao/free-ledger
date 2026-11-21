/* 日期工具：全部使用本地时区的 YYYY-MM-DD 字符串与 YYYY-MM 月份。 */

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function currentMonth(): string {
  return todayISO().slice(0, 7)
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

export function isValidDate(iso: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(iso)) return false
  const date = parseISO(iso)
  return toISO(date) === iso
}

/** 月份加减，如 addMonths('2026-01', -1) → '2025-12'。 */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}年${m}月`
}

export function shortMonthLabel(month: string): string {
  const [, m] = month.split('-').map(Number)
  return `${m}月`
}

export function weekdayOf(iso: string): string {
  return WEEKDAYS[parseISO(iso).getDay()]
}

/** 今天 / 昨天 / 11月20日 周四（跨年时带年份）。 */
export function dateLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return '今天'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (iso === toISO(yesterday)) return '昨天'

  const date = parseISO(iso)
  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`
  const prefix = date.getFullYear() === new Date().getFullYear() ? '' : `${date.getFullYear()}年`
  return `${prefix}${monthDay} ${weekdayOf(iso)}`
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** 当前月份内所有日期，用于测试或日历视图。 */
export function datesOfMonth(month: string): string[] {
  const total = daysInMonth(month)
  return Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}
