import type { RecurringItem } from '../types'

export type RecurringEntry = {
  id: string
  recurringId: string
  month: string
  kind: 'expense' | 'income'
  description: string
  category: string
  amount: number
  date: string
  status: 'paid' | 'planned'
  card?: string
  payment?: string
}

export function shiftMonthKey(key: string, amount: number) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function recurringDate(month: string, dayOfMonth: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return `${month}-${String(Math.min(Math.max(1, dayOfMonth), lastDay)).padStart(2, '0')}`
}

function monthsBetween(from: string, to: string) {
  const months: string[] = []
  let cursor = from
  while (cursor <= to && months.length < 60) { months.push(cursor); cursor = shiftMonthKey(cursor, 1) }
  return months
}

/** Ids dos lançamentos que a versão anterior já criou sozinha (`rec-<item>-<mês>`): continuam como estão e não duplicam. */
export function legacyRecurringIds(records: { id: string }[]) {
  return new Set(records.filter((item) => item.id.startsWith('rec-')).map((item) => item.id))
}

/**
 * Ocorrências mensais de cada item recorrente, como as parcelas: cada mês aparece "prevista"
 * e só vira paga/recebida quando a pessoa marca. `month` mostra um mês; `all` vai do início até `upTo`.
 */
export function recurringEntries(
  items: RecurringItem[],
  legacy: Set<string>,
  scope: { type: 'month'; month: string } | { type: 'all'; upTo: string },
): RecurringEntry[] {
  const entries: RecurringEntry[] = []
  for (const item of items) {
    if (!/^\d{4}-\d{2}$/.test(item.startMonth)) continue
    const paidMonths = new Set(item.paidMonths ?? [])
    let months: string[]
    if (scope.type === 'month') {
      months = paidMonths.has(scope.month) || (item.active && scope.month >= item.startMonth) ? [scope.month] : []
    } else {
      months = [...new Set([...(item.active ? monthsBetween(item.startMonth, scope.upTo) : []), ...paidMonths])].sort()
    }
    for (const month of months) {
      if (legacy.has(`rec-${item.id}-${month}`)) continue
      entries.push({
        id: `rec:${item.id}:${month}`, recurringId: item.id, month, kind: item.kind,
        description: item.description, category: item.category, amount: item.amount,
        date: recurringDate(month, item.dayOfMonth), status: paidMonths.has(month) ? 'paid' : 'planned',
        ...(item.card ? { card: item.card } : {}), ...(item.payment ? { payment: item.payment } : {}),
      })
    }
  }
  return entries
}

export function setRecurringPaid(item: RecurringItem, month: string, paid: boolean): RecurringItem {
  const months = new Set(item.paidMonths ?? [])
  if (paid) months.add(month)
  else months.delete(month)
  return { ...item, paidMonths: [...months].sort() }
}
