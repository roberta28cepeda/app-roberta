import type { InstallmentPlan } from '../types'

export type ScheduledInstallment = {
  id: string
  planId: string
  description: string
  category: string
  amount: number
  date: string
  installmentNumber: number
  installmentTotal: number
  status: 'planned' | 'paid'
  card?: string
  payment?: string
}

export function addMonthsToDate(value: string, offset: number) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day || !Number.isInteger(offset)) return ''
  const target = new Date(year, month - 1 + offset, 1)
  const finalDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, finalDay))
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
}

export function scheduleInstallments(plan: InstallmentPlan): ScheduledInstallment[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.firstDueDate)
    || !Number.isFinite(plan.amount) || plan.amount <= 0
    || !Number.isInteger(plan.firstInstallmentNumber) || !Number.isInteger(plan.totalInstallments)
    || plan.firstInstallmentNumber < 1 || plan.totalInstallments < plan.firstInstallmentNumber
    || plan.totalInstallments > 120) return []

  const paid = new Set(plan.paidInstallments.filter((number) => Number.isInteger(number) && number >= 1 && number <= plan.totalInstallments))
  const installments: ScheduledInstallment[] = []
  for (let number = plan.firstInstallmentNumber; number <= plan.totalInstallments; number += 1) {
    const date = addMonthsToDate(plan.firstDueDate, number - plan.firstInstallmentNumber)
    if (!date) continue
    installments.push({
      id: `${plan.id}:${number}`,
      planId: plan.id,
      description: plan.description,
      category: plan.category,
      amount: plan.amount,
      date,
      installmentNumber: number,
      installmentTotal: plan.totalInstallments,
      status: paid.has(number) ? 'paid' : 'planned',
      ...(plan.card ? { card: plan.card } : {}),
      ...(plan.payment ? { payment: plan.payment } : {}),
    })
  }
  return installments
}
