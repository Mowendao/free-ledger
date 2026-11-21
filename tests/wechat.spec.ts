import { describe, expect, it } from 'vitest'
import { parseCsv, parseWechatBill } from '@/services/wechat'

const HEADER =
  '交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注'

const BILL = [
  '微信支付账单明细',
  '微信昵称：[测试]',
  '----------------------微信支付账单明细列表--------------------',
  HEADER,
  '2026-11-21 12:30:00,商户消费,便利店,矿泉水,支出,¥3.50,零钱,支付成功,4200001,1001,',
  '2026-11-20 09:00:00,转账,张三,转账,收入,¥50.00,零钱,已收钱,4200002,1002,还款',
  '2026-11-19 08:00:00,零钱提现,提现,提现,不计收支,¥100.00,零钱,提现成功,4200003,1003,',
  '2026-11-18 08:00:00,商户消费,"便利店, 24h",咖啡,支出,"¥12.30",零钱,支付成功,4200004,1004,"加班, 提神"'
].join('\n')

describe('微信账单解析', () => {
  it('读取收支、跳过不计收支，并全部标为未分类', () => {
    const { transactions, stats } = parseWechatBill(BILL, 'acc-1')

    expect(transactions).toHaveLength(3)
    expect(stats.expenseCount).toBe(2)
    expect(stats.incomeCount).toBe(1)
    expect(stats.expenseCents).toBe(1580)
    expect(stats.incomeCents).toBe(5000)
    expect(stats.skipped).toBe(1)
    expect(transactions.every((tx) => tx.categoryId === null)).toBe(true)
    expect(transactions.every((tx) => tx.accountId === 'acc-1')).toBe(true)
    expect(transactions.every((tx) => tx.deletedAt === null)).toBe(true)
  })

  it('用交易单号作为稳定 id，并跳过文件内重复行', () => {
    const text = `${BILL}\n2026-11-21 12:30:00,商户消费,便利店,矿泉水,支出,¥3.50,零钱,支付成功,4200001,1001,`
    const { transactions, stats } = parseWechatBill(text, 'acc-1')

    expect(transactions.find((tx) => tx.id === 'wx-4200001')).toBeTruthy()
    expect(stats.duplicates).toBe(1)
  })

  it('没有交易单号时生成稳定哈希 id', () => {
    const noId = BILL.replace(',4200001,1001,', ',,')
    const first = parseWechatBill(noId, 'acc').transactions
    const second = parseWechatBill(noId, 'acc').transactions

    expect(first[0].id).toMatch(/^wx-/)
    expect(first[0].id).toBe(second[0].id)
  })

  it('CSV 引号内的逗号与转义引号', () => {
    const rows = parseCsv('a,"b,c","d""e"\n1,2,3')
    expect(rows[0]).toEqual(['a', 'b,c', 'd"e'])
    expect(rows[1]).toEqual(['1', '2', '3'])
  })

  it('拒绝没有微信账单表头的文件', () => {
    expect(() => parseWechatBill('a,b,c\n1,2,3', 'acc')).toThrow('表头')
  })

  it('金额保留两位精度', () => {
    const { transactions } = parseWechatBill(BILL, 'acc')
    expect(transactions.map((tx) => tx.amountCents).sort((a, b) => a - b)).toEqual([
      350, 1230, 5000
    ])
  })
})
