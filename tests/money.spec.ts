import { describe, expect, it } from 'vitest'
import { MAX_AMOUNT_CENTS, formatCents, parseCents, toAmountInput } from '@/services/money'

describe('parseCents', () => {
  it('把元转成整数分', () => {
    expect(parseCents('12.34')).toBe(1234)
    expect(parseCents('0.01')).toBe(1)
    expect(parseCents('100')).toBe(10000)
  })

  it('容忍千分位、货币符号与空格', () => {
    expect(parseCents('¥ 1,234.50')).toBe(123450)
    expect(parseCents(' 8.8 ')).toBe(880)
  })

  it('拒绝空值、负数与非法字符', () => {
    expect(parseCents('')).toBe(0)
    expect(parseCents('-5')).toBe(0)
    expect(parseCents('abc')).toBe(0)
    expect(parseCents('0')).toBe(0)
  })

  it('超过上限时截断', () => {
    expect(parseCents('99999999')).toBe(MAX_AMOUNT_CENTS)
  })

  it('避免浮点误差', () => {
    expect(parseCents('0.07')).toBe(7)
    expect(parseCents('1.1')).toBe(110)
    expect(parseCents('19.99')).toBe(1999)
  })
})

describe('formatCents', () => {
  it('带千分位与两位小数', () => {
    expect(formatCents(0)).toBe('0.00')
    expect(formatCents(1234)).toBe('12.34')
    expect(formatCents(123456789)).toBe('1,234,567.89')
  })

  it('保留负号', () => {
    expect(formatCents(-1234)).toBe('-12.34')
  })
})

describe('toAmountInput', () => {
  it('去掉多余的小数零', () => {
    expect(toAmountInput(1200)).toBe('12')
    expect(toAmountInput(1250)).toBe('12.5')
    expect(toAmountInput(1255)).toBe('12.55')
    expect(toAmountInput(0)).toBe('0')
  })
})
