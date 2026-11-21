import { describe, expect, it } from 'vitest'
import {
  addMonths,
  currentMonth,
  dateLabel,
  daysInMonth,
  isValidDate,
  isValidMonth,
  monthLabel,
  monthOf,
  parseISO,
  shortMonthLabel,
  toISO,
  todayISO,
  weekdayOf
} from '@/services/dates'

describe('日期格式与校验', () => {
  it('本地日期转 ISO 字符串', () => {
    expect(toISO(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toISO(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('拒绝不存在的日期', () => {
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2025-02-29')).toBe(false)
    expect(isValidDate('2024-02-29')).toBe(true)
    expect(isValidDate('2026-13-01')).toBe(false)
    expect(isValidDate('2026-1-1')).toBe(false)
  })

  it('校验月份', () => {
    expect(isValidMonth('2026-11')).toBe(true)
    expect(isValidMonth('2026-00')).toBe(false)
    expect(isValidMonth('2026-13')).toBe(false)
  })

  it('月份加减跨年', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-11', -14)).toBe('2025-09')
  })

  it('月份标签与当月天数', () => {
    expect(monthLabel('2026-11')).toBe('2026年11月')
    expect(shortMonthLabel('2026-11')).toBe('11月')
    expect(daysInMonth('2024-02')).toBe(29)
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2026-04')).toBe(30)
  })

  it('从日期取月份', () => {
    expect(monthOf('2026-11-21')).toBe('2026-11')
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('展示用日期', () => {
  it('今天与昨天', () => {
    expect(dateLabel(todayISO())).toBe('今天')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(dateLabel(toISO(yesterday))).toBe('昨天')
  })

  it('其他日期带星期', () => {
    expect(dateLabel('2020-01-01')).toBe('2020年1月1日 周三')
    expect(weekdayOf('2026-11-21')).toBe('周六')
  })

  it('parseISO 使用本地时区', () => {
    const date = parseISO('2026-11-21')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(10)
    expect(date.getDate()).toBe(21)
  })
})
