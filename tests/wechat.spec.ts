import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { isXlsxFile, parseCsv, parseWechatBill, parseWechatFile, parseWechatWorkbook } from '@/services/wechat'

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
  '2026-11-17 08:00:00,零钱提现,提现,提现,/,¥100.00,零钱,提现成功,4200005,1005,',
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
    expect(stats.skipped).toBe(2)
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

function columnName(index: number): string {
  let name = ''
  let value = index + 1
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function toBuffer(zip: Uint8Array): ArrayBuffer {
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer
}

function buildInlineXlsx(rows: string[][]): ArrayBuffer {
  const rowXml = rows
    .map((cells, rowIndex) => {
      const cellXml = cells
        .map(
          (value, column) =>
            `<c r="${columnName(column)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(
              value
            )}</t></is></c>`
        )
        .join('')
      return `<row r="${rowIndex + 1}">${cellXml}</row>`
    })
    .join('')
  const sheet = `<worksheet><sheetData>${rowXml}</sheetData></worksheet>`
  return toBuffer(zipSync({ 'xl/worksheets/sheet1.xml': strToU8(sheet) }))
}

describe('xlsx 账单', () => {
  const rows = [
    [],
    ['微信支付账单明细'],
    [],
    [
      '交易时间',
      '交易类型',
      '交易对方',
      '商品',
      '收/支',
      '金额(元)',
      '支付方式',
      '当前状态',
      '交易单号',
      '商户单号',
      '备注'
    ],
    [
      '2026-11-21 12:30:00',
      '商户消费',
      '便利店',
      '矿泉水',
      '支出',
      '¥3.50',
      '零钱',
      '支付成功',
      '4200001',
      '',
      ''
    ],
    [
      '2026-11-20 09:00:00',
      '转账',
      '张三',
      '转账',
      '收入',
      '50.00',
      '零钱',
      '已收钱',
      '4200002',
      '',
      '还款'
    ]
  ]

  it('识别 xlsx 并解析收支', () => {
    const buffer = buildInlineXlsx(rows)
    expect(isXlsxFile(buffer)).toBe(true)

    const { transactions, stats } = parseWechatFile(buffer, 'acc')
    expect(transactions).toHaveLength(2)
    expect(stats.expenseCents).toBe(350)
    expect(stats.incomeCents).toBe(5000)
    expect(transactions[0].note).toContain('便利店')
    expect(transactions.every((tx) => tx.categoryId === null)).toBe(true)
  })

  it('支持共享字符串与数字金额', () => {
    const shared = [
      '交易时间',
      '金额(元)',
      '收/支',
      '交易单号',
      '2026-11-21 12:30:00',
      '支出',
      '12.00',
      '4200009'
    ]
    const sheet = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
      <row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2" t="s"><v>6</v></c><c r="C2" t="s"><v>5</v></c><c r="D2" t="s"><v>7</v></c></row>
    </sheetData></worksheet>`
    const sharedXml = `<sst>${shared.map((value) => `<si><t>${value}</t></si>`).join('')}</sst>`
    const buffer = toBuffer(
      zipSync({
        'xl/worksheets/sheet1.xml': strToU8(sheet),
        'xl/sharedStrings.xml': strToU8(sharedXml)
      })
    )

    const { transactions } = parseWechatFile(buffer, 'acc')
    expect(transactions).toHaveLength(1)
    expect(transactions[0].amountCents).toBe(1200)
    expect(transactions[0].id).toBe('wx-4200009')
  })

  it('行号不连续时也能解析（空行不写入）', () => {
    const rowXml = (rowNumber: number, cells: string[]): string =>
      `<row r="${rowNumber}">${cells
        .map(
          (value, column) =>
            `<c r="${columnName(column)}${rowNumber}" t="inlineStr"><is><t>${escapeXml(
              value
            )}</t></is></c>`
        )
        .join('')}</row>`

    const sheet = `<worksheet><sheetData>
      ${rowXml(1, ['微信支付账单明细'])}
      ${rowXml(4, ['交易时间', '金额(元)', '收/支', '交易单号'])}
      ${rowXml(5, ['2026-11-21 12:30:00', '12.00', '支出', '4200001'])}
    </sheetData></worksheet>`
    const buffer = toBuffer(zipSync({ 'xl/worksheets/sheet1.xml': strToU8(sheet) }))

    const { transactions } = parseWechatWorkbook(buffer, 'acc')
    expect(transactions).toHaveLength(1)
    expect(transactions[0].date).toBe('2026-11-21')
  })

  it('支持 Excel 日期序列号', () => {
    const serial = (Date.UTC(2026, 10, 21) - Date.UTC(1899, 11, 30)) / 86400000
    const header = ['交易时间', '金额(元)', '收/支', '交易单号']
      .map(
        (value, column) =>
          `<c r="${columnName(column)}1" t="inlineStr"><is><t>${value}</t></is></c>`
      )
      .join('')
    const data = [
      `<c r="A2"><v>${serial}</v></c>`,
      '<c r="B2"><v>12.5</v></c>',
      '<c r="C2" t="inlineStr"><is><t>支出</t></is></c>',
      '<c r="D2" t="inlineStr"><is><t>4200005</t></is></c>'
    ].join('')
    const sheet = `<worksheet><sheetData><row r="1">${header}</row><row r="2">${data}</row></sheetData></worksheet>`
    const buffer = toBuffer(zipSync({ 'xl/worksheets/sheet1.xml': strToU8(sheet) }))

    const { transactions } = parseWechatWorkbook(buffer, 'acc')
    expect(transactions[0].date).toBe('2026-11-21')
    expect(transactions[0].amountCents).toBe(1250)
  })
})
