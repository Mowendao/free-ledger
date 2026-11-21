/* 微信支付账单解析（CSV / XLSX）：不联网、不上传。
   账单来自微信「我 → 服务 → 钱包 → 账单 → 常见问题 → 下载账单」。 */
import { strFromU8, unzipSync } from 'fflate'
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

/** 解码 CSV：兼容 UTF-8（含 BOM）与 GBK。 */
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

export function isXlsxFile(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer)
  return bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

/** 按文件内容自动选择 CSV 或 XLSX 解析。 */
export function parseWechatFile(buffer: ArrayBuffer, accountId: string): WechatBillResult {
  return isXlsxFile(buffer)
    ? parseWechatWorkbook(buffer, accountId)
    : parseWechatBill(decodeWechatCsv(buffer), accountId)
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

/** 读取 xlsx（本质是 zip + XML），返回二维表。 */
export function readWorkbookRows(buffer: ArrayBuffer): string[][] {
  const files = unzipSync(new Uint8Array(buffer))
  const entries = Object.entries(files)
  const find = (predicate: (name: string) => boolean): Uint8Array | undefined =>
    entries.find(([name]) => predicate(name.replace(/^\/+/, '')))?.[1]

  const sheet =
    find((name) => /^xl\/worksheets\/sheet1\.xml$/i.test(name)) ??
    find((name) => /^xl\/worksheets\/[^/]+\.xml$/i.test(name))
  if (!sheet) throw new Error('Excel 文件中找不到工作表')

  const sharedFile = find((name) => name === 'xl/sharedStrings.xml')
  const sharedStrings = sharedFile ? parseSharedStrings(strFromU8(sharedFile)) : []
  return parseSheetXml(strFromU8(sheet), sharedStrings)
}

export function parseWechatBill(text: string, accountId: string): WechatBillResult {
  return parseWechatRows(parseCsv(text), accountId)
}

export function parseWechatWorkbook(buffer: ArrayBuffer, accountId: string): WechatBillResult {
  return parseWechatRows(readWorkbookRows(buffer), accountId)
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

export function parseWechatRows(rows: string[][], accountId: string): WechatBillResult {
  if (!accountId) throw new Error('请先选择要记入的账户')

  const headerIndex = rows.findIndex(
    (cells) =>
      Array.isArray(cells) &&
      cells.some((cell) => (cell ?? '').trim() === '交易时间') &&
      cells.some((cell) => (cell ?? '').includes('金额'))
  )
  if (headerIndex < 0) {
    throw new Error('没有找到微信账单表头，请确认导出的是「微信支付账单明细」')
  }

  const header = rows[headerIndex].map((cell) => (cell ?? '').trim())
  const column = (names: string[]): number =>
    header.findIndex((title) => names.some((name) => title === name || title.includes(name)))

  const index = {
    time: column(HEADER_ALIASES.time),
    direction: column(HEADER_ALIASES.direction),
    amount: column(HEADER_ALIASES.amount),
    counterparty: column(HEADER_ALIASES.counterparty),
    product: column(HEADER_ALIASES.product),
    note: column(HEADER_ALIASES.note),
    tradeNo: column(HEADER_ALIASES.tradeNo)
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
    const cells = rows[rowIndex] ?? []
    const read = (columnIndex: number): string =>
      columnIndex >= 0 ? (cells[columnIndex] ?? '').trim() : ''

    const time = normalizeTime(read(index.time))
    const direction = read(index.direction)
    const amountText = read(index.amount)
    if (!time && !direction && !amountText) continue

    if (direction === '不计收支' || direction === '/') {
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

/* ---------- xlsx XML ---------- */

function parseSheetXml(xml: string, sharedStrings: string[]): string[][] {
  const matrix: string[][] = []
  const rowPattern = /<((?:[A-Za-z0-9]+:)?row)\b([^>]*)>([\s\S]*?)<\/\1>/gi
  const cellPattern = /<((?:[A-Za-z0-9]+:)?c)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
  const valuePattern = /<(?:[A-Za-z0-9]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9]+:)?v>/i

  for (const rowMatch of xml.matchAll(rowPattern)) {
    const rowXml = rowMatch[3] ?? ''
    const rowIndex = Number(/r="(\d+)"/i.exec(rowMatch[2] ?? '')?.[1] ?? matrix.length + 1)
    const cells: string[] = []

    for (const cellMatch of rowXml.matchAll(cellPattern)) {
      const attrs = cellMatch[2] ?? ''
      const inner = cellMatch[3] ?? ''
      const reference = /r="([A-Z]+)\d+"/i.exec(attrs)?.[1]
      const type = /\bt="([^"]+)"/i.exec(attrs)?.[1]
      const column = reference ? columnIndex(reference) : cells.length
      cells[column] = extractCell(inner, type, sharedStrings, valuePattern)
    }

    matrix[rowIndex - 1] = cells
  }

  // xlsx 的行号可能不连续（空行不写），转成稠密数组，避免下游拿到 undefined
  const dense: string[][] = []
  for (let index = 0; index < matrix.length; index += 1) {
    dense.push(matrix[index] ?? [])
  }
  return dense
}

function extractCell(
  inner: string,
  type: string | undefined,
  sharedStrings: string[],
  valuePattern: RegExp
): string {
  if (type === 'inlineStr') {
    return unescapeXml(collectText(inner))
  }
  const raw = valuePattern.exec(inner)?.[1]
  if (raw === undefined) return ''
  const value = unescapeXml(raw)
  if (type === 's') {
    const shared = sharedStrings[Number(value)]
    return shared ?? ''
  }
  return value
}

function parseSharedStrings(xml: string): string[] {
  const items: string[] = []
  const siPattern = /<((?:[A-Za-z0-9]+:)?si)\b[^>]*>([\s\S]*?)<\/\1>/gi
  for (const match of xml.matchAll(siPattern)) {
    items.push(unescapeXml(collectText(match[2] ?? '')))
  }
  return items
}

function collectText(xml: string): string {
  const tPattern = /<(?:[A-Za-z0-9]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9]+:)?t>/gi
  return [...xml.matchAll(tPattern)].map((match) => match[1] ?? '').join('')
}

function columnIndex(reference: string): number {
  const letters = reference.replace(/\d+/g, '').toUpperCase()
  let index = 0
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64)
  return index - 1
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

/** Excel 可能把时间存成序列号；转成 YYYY-MM-DD HH:mm:ss。 */
function normalizeTime(value: string): string {
  if (!/^\d+(\.\d+)?$/.test(value)) return value
  const serial = Number(value)
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return value
  const date = new Date(Math.round((serial - 25569) * 86400000))
  const pad = (part: number): string => String(part).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
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
