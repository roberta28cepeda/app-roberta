import type { Expense, Income } from '../types'
import { paymentFields } from './payment'

function quoteCsv(value: string) {
  const safe = /^[\u0000-\u0020]*[=+@-]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: string[][]) {
  const contents = `\uFEFF${rows.map((row) => row.map(quoteCsv).join(';')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function csvDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function csvAmount(value: number) {
  return value.toFixed(2).replace('.', ',')
}

function stamp() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function downloadExpensesCsv(expenses: Expense[]) {
  const rows = [
    ['Data', 'Descrição', 'Categoria', 'Valor da parcela (R$)', 'Parcela atual', 'Total de parcelas', 'Parcelas restantes', 'Forma de pagamento', 'Cartão'],
    ...[...expenses].sort((a, b) => b.date.localeCompare(a.date)).map((item) => [
      csvDate(item.date), item.description, item.category, csvAmount(item.amount),
      item.installmentNumber ? String(item.installmentNumber) : '',
      item.installmentTotal ? String(item.installmentTotal) : '',
      item.installmentNumber && item.installmentTotal ? String(item.installmentTotal - item.installmentNumber) : '',
      item.payment ?? '', item.card ?? '',
    ]),
  ]
  downloadCsv(`minha-vida-gastos-${stamp()}.csv`, rows)
}

export function downloadIncomesCsv(incomes: Income[]) {
  const rows = [
    ['Data', 'Descrição', 'Origem', 'Valor recebido (R$)'],
    ...[...incomes].sort((a, b) => b.date.localeCompare(a.date)).map((item) => [
      csvDate(item.date), item.description, item.source, csvAmount(item.amount),
    ]),
  ]
  downloadCsv(`minha-vida-recebimentos-${stamp()}.csv`, rows)
}

function parseCsvRows(text: string) {
  const source = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1 }
      else quoted = !quoted
    } else if (character === ';' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell)
      cell = ''
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
    } else cell += character
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function normalizeHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

function parseAmount(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(/^R\$/i, '')
  const decimal = normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized
  return Number(decimal)
}

function parseDate(value: string) {
  const normalized = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  const parts = normalized.split(/[/.]/)
  if (parts.length !== 3 || parts[2].length !== 4) return ''
  const day = parts[0].padStart(2, '0')
  const month = parts[1].padStart(2, '0')
  const year = parts[2]
  const candidate = `${year}-${month}-${day}`
  const date = new Date(`${candidate}T12:00:00`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== candidate ? '' : candidate
}

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function parseExpenseCsv(text: string, existing: Expense[]) {
  const rows = parseCsvRows(text)
  const headers = rows[0]?.map(normalizeHeader) ?? []
  const dateIndex = headers.findIndex((header) => header.includes('data'))
  const descriptionIndex = headers.findIndex((header) => header.includes('descricao'))
  const categoryIndex = headers.findIndex((header) => header.includes('categoria'))
  const amountIndex = headers.findIndex((header) => header.includes('valor'))
  const installmentIndex = headers.findIndex((header) => header.includes('parcela atual'))
  const totalInstallmentsIndex = headers.findIndex((header) => header.includes('total de parcelas'))
  const paymentIndex = headers.findIndex((header) => header.includes('forma de pagamento'))
  const cardIndex = headers.findIndex((header) => header === 'cartao')
  if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0) {
    throw new Error('O CSV precisa ter as colunas Data, Descrição e Valor.')
  }

  const signature = (item: Expense) => [
    item.date, item.description.toLocaleLowerCase('pt-BR'), item.category,
    item.amount.toFixed(2), item.installmentNumber ?? '', item.installmentTotal ?? '',
  ].join('|')
  const signatures = new Set(existing.map(signature))
  const items: Expense[] = []
  let ignored = 0
  for (const row of rows.slice(1)) {
    const description = row[descriptionIndex]?.trim() ?? ''
    const date = parseDate(row[dateIndex] ?? '')
    const amount = parseAmount(row[amountIndex] ?? '')
    const category = categoryIndex >= 0 ? row[categoryIndex]?.trim() || 'Sem categoria' : 'Sem categoria'
    const rawInstallment = installmentIndex >= 0 ? row[installmentIndex]?.trim() ?? '' : ''
    const rawTotal = totalInstallmentsIndex >= 0 ? row[totalInstallmentsIndex]?.trim() ?? '' : ''
    const installmentNumber = rawInstallment ? Number(rawInstallment) : undefined
    const installmentTotal = rawTotal ? Number(rawTotal) : undefined
    if (!description || !date || !Number.isFinite(amount) || amount <= 0
      || (installmentNumber === undefined) !== (installmentTotal === undefined)
      || (installmentNumber !== undefined && (!Number.isInteger(installmentNumber)
        || !Number.isInteger(installmentTotal) || installmentNumber < 1
        || installmentTotal! < 2 || installmentNumber > installmentTotal! || installmentTotal! > 120))) {
      ignored += 1
      continue
    }
    const item: Expense = {
      id: createId(), description, category, amount, date,
      ...(installmentNumber !== undefined ? { installmentNumber, installmentTotal } : {}),
      ...paymentFields(paymentIndex >= 0 ? row[paymentIndex]?.trim() ?? '' : '', cardIndex >= 0 ? row[cardIndex]?.trim() ?? '' : ''),
    }
    const key = signature(item)
    if (signatures.has(key)) { ignored += 1; continue }
    signatures.add(key)
    items.push(item)
  }
  return { items, ignored }
}

export function parseIncomeCsv(text: string, existing: Income[]) {
  const rows = parseCsvRows(text)
  const headers = rows[0]?.map(normalizeHeader) ?? []
  const dateIndex = headers.findIndex((header) => header.includes('data'))
  const descriptionIndex = headers.findIndex((header) => header.includes('descricao'))
  const sourceIndex = headers.findIndex((header) => header.includes('origem') || header.includes('categoria'))
  const amountIndex = headers.findIndex((header) => header.includes('valor'))
  if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0) {
    throw new Error('O CSV precisa ter as colunas Data, Descrição e Valor.')
  }

  const signature = (item: Income) => [item.date, item.description.toLocaleLowerCase('pt-BR'), item.source, item.amount.toFixed(2)].join('|')
  const signatures = new Set(existing.map(signature))
  const items: Income[] = []
  let ignored = 0
  for (const row of rows.slice(1)) {
    const description = row[descriptionIndex]?.trim() ?? ''
    const date = parseDate(row[dateIndex] ?? '')
    const amount = parseAmount(row[amountIndex] ?? '')
    const source = sourceIndex >= 0 ? row[sourceIndex]?.trim() || 'Outro' : 'Outro'
    if (!description || !date || !Number.isFinite(amount) || amount <= 0) { ignored += 1; continue }
    const item: Income = { id: createId(), description, source, amount, date }
    const key = signature(item)
    if (signatures.has(key)) { ignored += 1; continue }
    signatures.add(key)
    items.push(item)
  }
  return { items, ignored }
}
