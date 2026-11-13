import type { Expense, Income, RecurringItem } from '../types'

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

/**
 * Cria os lançamentos vencidos de cada item recorrente (um por mês, até hoje).
 * Os ids são determinísticos (`rec-<item>-<mês>`): se dois aparelhos gerarem ao mesmo tempo,
 * gravam o mesmo documento em vez de duplicar.
 */
export function generateRecurring(items: RecurringItem[], today: string) {
  const expenses: Expense[] = []
  const incomes: Income[] = []
  const updated: RecurringItem[] = []
  const thisMonth = today.slice(0, 7)
  for (const item of items) {
    if (!item.active || !/^\d{4}-\d{2}$/.test(item.startMonth)) continue
    let month = item.lastGenerated ? shiftMonthKey(item.lastGenerated, 1) : item.startMonth
    let last = item.lastGenerated
    let guard = 0
    while (month <= thisMonth && guard < 60) {
      const date = recurringDate(month, item.dayOfMonth)
      if (date > today) break
      const id = `rec-${item.id}-${month}`
      if (item.kind === 'expense') expenses.push({ id, description: item.description, category: item.category, amount: item.amount, date, ...(item.payment ? { payment: item.payment } : {}), ...(item.card ? { card: item.card } : {}) })
      else incomes.push({ id, description: item.description, source: item.category, amount: item.amount, date })
      last = month
      month = shiftMonthKey(month, 1)
      guard += 1
    }
    if (last !== item.lastGenerated) updated.push({ ...item, lastGenerated: last })
  }
  return { expenses, incomes, updated }
}
