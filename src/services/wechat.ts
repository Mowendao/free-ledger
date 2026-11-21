/* 微信支付账单 CSV 本地解析：不联网、不上传。
   账单来自微信「我 → 服务 → 钱包 → 账单 → 常见问题 → 下载账单」导出的 CSV。 */
import type { Transaction } from '@/db/schema'
import { isValidDate } from './dates'
import { parseCents } from './money'

export interface WechatBillStats {
  imported: number
  expenseCount: number
  incomeCount: number
  expenseCents: number
  incomeCents: number
  skipped: number
  invalid: number
  duplicates: number
  firstDate: string | null
  lastDate: string | null
}

export interface WechatBillResult {
  transactions: Transaction[]
  stats: WechatBillStats
}

/** 解码账单：兼容 UTF-8（含 BOM）与 GBK。 */
export function decodeWechatCsv(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    try {
      return new TextDecoder('gbk').decode(bytes)
    } catch {
      return new TextDecoder('utf-8').decode(bytes)
    }
  }
}

/** 简单的 CSV 解析：支持引号、转义引号与字段内换行。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const source = text.replace(/^\uFEFF/, '')

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') inQuotes = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

function hash(input: string): string {
  let value = 5381
  for (let index = 0; index < input.length; index += 1) {
    value = ((value << 5) + value + input.charCodeAt(index)) | 0
  }
  return (value >>> 0).toString(36)
}

function sanitize(value: string): string {
  return value.replace(/[^\w-]/g, '').slice(0, 60)
}

function parseLocalTimestamp(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match.map(Number)
  const date = new Date(year, month - 1, day, hour, minute, second)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

const HEADER_ALIASES = {
  time: ['交易时间'],
  direction: ['收/支', '收支'],
  amount: ['金额(元)', '金额（元）', '金额'],
  counterparty: ['交易对方'],
  product: ['商品'],
  note: ['备注'],
  tradeNo: ['交易单号'],
  method: ['支付方式']
}

export function parseWechatBill(text: string, accountId: string): WechatBillResult {
  if (!accountId) throw new Error('请先选择要记入的账户')
  const rows = parseCsv(text)
  const headerIndex = rows.findIndex(
    (cells) =>
      cells.some((cell) => cell.trim() === '交易时间') &&
      cells.some((cell) => cell.includes('金额'))
  )
  if (headerIndex < 0) {
    throw new Error('没有找到微信账单表头，请确认导出的是「微信支付账单明细」CSV')
  }

  const header = rows[headerIndex].map((cell) => cell.trim())
  const column = (names: string[]): number =>
    header.findIndex((title) => names.some((name) => title === name || title.includes(name)))

  const index = {
    time: column(HEADER_ALIASES.time),
    direction: column(HEADER_ALIASES.direction),
    amount: column(HEADER_ALIASES.amount),
    counterparty: column(HEADER_ALIASES.counterparty),
    product: column(HEADER_ALIASES.product),
    note: column(HEADER_ALIASES.note),
    tradeNo: column(HEADER_ALIASES.tradeNo),
    method: column(HEADER_ALIASES.method)
  }

  const transactions: Transaction[] = []
  const seenIds = new Set<string>()
  const stats: WechatBillStats = {
    imported: 0,
    expenseCount: 0,
    incomeCount: 0,
    expenseCents: 0,
    incomeCents: 0,
    skipped: 0,
    invalid: 0,
    duplicates: 0,
    firstDate: null,
    lastDate: null
  }

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const cells = rows[rowIndex]
    const read = (columnIndex: number): string =>
      columnIndex >= 0 ? (cells[columnIndex] ?? '').trim() : ''

    const time = read(index.time)
    const direction = read(index.direction)
    const amountText = read(index.amount)
    if (!time && !direction && !amountText) continue

    if (direction === '不计收支') {
      stats.skipped += 1
      continue
    }
    if (direction !== '收入' && direction !== '支出') {
      stats.invalid += 1
      continue
    }

    const date = time.slice(0, 10)
    const cents = parseCents(amountText)
    if (!isValidDate(date) || cents <= 0) {
      stats.invalid += 1
      continue
    }

    const tradeNo = read(index.tradeNo)
    const id = tradeNo
      ? `wx-${sanitize(tradeNo) || hash(`${time}|${direction}|${amountText}`)}`
      : `wx-${hash(`${time}|${direction}|${amountText}|${read(index.counterparty)}`)}`

    if (seenIds.has(id)) {
      stats.duplicates += 1
      continue
    }
    seenIds.add(id)

    const kind = direction === '收入' ? 'income' : 'expense'
    const counterparty = read(index.counterparty)
    const product = read(index.product)
    const note = [counterparty, product, read(index.note)].filter(Boolean).join(' · ').slice(0, 100)
    const timestamp = parseLocalTimestamp(time) ?? Date.now()

    transactions.push({
      id,
      kind,
      amountCents: cents,
      categoryId: null,
      accountId,
      toAccountId: null,
      date,
      note,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null
    })

    stats.imported += 1
    if (kind === 'expense') {
      stats.expenseCount += 1
      stats.expenseCents += cents
    } else {
      stats.incomeCount += 1
      stats.incomeCents += cents
    }
    if (!stats.firstDate || date < stats.firstDate) stats.firstDate = date
    if (!stats.lastDate || date > stats.lastDate) stats.lastDate = date
  }

  if (transactions.length === 0) {
    throw new Error('没有解析到可导入的收支记录，请检查账单文件')
  }

  return { transactions, stats }
}
