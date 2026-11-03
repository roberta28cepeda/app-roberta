import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Download,
  Filter,
  PiggyBank,
  Plus,
  Search,
  Sparkles,
  Tags,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
  Pencil,
} from 'lucide-react'
import type { AppRecord, CollectionName, CustomCategory, Expense, Income, InstallmentPlan, LifeData, MonthlyBudget } from '../types'
import { defaultCategoryNames, getCategoryMeta, getSavingsIdea } from './categories'
import { downloadExpensesCsv, downloadIncomesCsv, parseExpenseCsv, parseIncomeCsv } from './csv'
import { scheduleInstallments } from './installments'
import './FinanceView.css'

type FinanceViewProps = {
  data: LifeData
  saveItem: (name: CollectionName, item: AppRecord) => Promise<void>
  removeItem: (name: CollectionName, id: string) => Promise<void>
}

type EntryForm = {
  type: 'expense' | 'income'
  description: string
  category: string
  amount: string
  date: string
  installmentsEnabled: boolean
  installmentNumber: string
  installmentTotal: string
  firstInstallmentPaid: boolean
}

type LedgerRow = {
  id: string
  type: 'expense' | 'income'
  date: string
  description: string
  category: string
  amount: number
  installmentNumber?: number
  installmentTotal?: number
  planId?: string
  status: 'paid' | 'planned'
}

type InstallmentPanelItem = {
  id: string
  planId?: string
  description: string
  category: string
  amount: number
  installmentNumber: number
  installmentTotal: number
  remainingCount: number
  remainingAmount: number
  nextDate?: string
  automatic: boolean
}

type TypeFilter = 'all' | 'expense' | 'income' | 'installments'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const incomeSources = ['Salário', 'Renda extra', 'Investimentos', 'Reembolso', 'Outros']

function todayKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function currentMonthKey() {
  return todayKey().slice(0, 7)
}

function monthLabel(key: string) {
  const date = new Date(`${key}-01T12:00:00`)
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1)
}

function shiftMonth(key: string, amount: number) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Data inválida'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', '')
}

function parseAmount(value: string) {
  const normalized = value.trim().includes(',')
    ? value.trim().replace(/\./g, '').replace(',', '.')
    : value.trim()
  return Number(normalized)
}

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.'
}

function FinanceMetric({ title, value, detail, tone, icon: Icon }: {
  title: string
  value: string
  detail: string
  tone: 'blue' | 'pink' | 'green' | 'lavender'
  icon: typeof WalletCards
}) {
  return (
    <article className={`finance-metric finance-metric-${tone}`}>
      <div className="finance-metric-top"><span>{title}</span><span className="finance-metric-icon"><Icon size={17} /></span></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function FinanceView({ data, saveItem, removeItem }: FinanceViewProps) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey)
  const [periodFilter, setPeriodFilter] = useState<'month' | 'all'>('month')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('Todas')
  const [query, setQuery] = useState('')
  const [budgetDraft, setBudgetDraft] = useState('')
  const [budgetError, setBudgetError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editing, setEditing] = useState<{ type: 'expense' | 'income' | 'installmentPlan'; id: string } | null>(null)
  const [formError, setFormError] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [categoryDraft, setCategoryDraft] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [form, setForm] = useState<EntryForm>({
    type: 'expense', description: '', category: 'Alimentação', amount: '', date: todayKey(),
    installmentsEnabled: false, installmentNumber: '1', installmentTotal: '2', firstInstallmentPaid: false,
  })

  const monthlyBudget = useMemo(
    () => data.budgets.find((item) => item.month === selectedMonth) ?? null,
    [data.budgets, selectedMonth],
  )
  useEffect(() => {
    setBudgetDraft(monthlyBudget ? String(monthlyBudget.amount).replace('.', ',') : '')
    setBudgetError('')
  }, [selectedMonth, monthlyBudget?.amount])

  const expenseCategories = useMemo(() => [...new Set([
    ...defaultCategoryNames,
    ...data.categories.map((item) => item.name),
    ...data.expenses.map((item) => item.category),
    ...data.installmentPlans.map((item) => item.category),
  ])], [data.categories, data.expenses, data.installmentPlans])
  const sourceOptions = useMemo(() => [...new Set([
    ...incomeSources,
    ...data.incomes.map((item) => item.source),
  ])], [data.incomes])
  const filterCategories = useMemo(() => [...new Set([
    ...expenseCategories,
    ...sourceOptions,
  ])], [expenseCategories, sourceOptions])

  const scheduledInstallments = useMemo(
    () => data.installmentPlans.flatMap(scheduleInstallments),
    [data.installmentPlans],
  )
  const convertedExpenseIds = useMemo(
    () => new Set(data.installmentPlans.map((item) => item.sourceExpenseId).filter((id): id is string => Boolean(id))),
    [data.installmentPlans],
  )
  const paidPlanExpenses = useMemo<Expense[]>(
    () => scheduledInstallments.filter((item) => item.status === 'paid').map((item) => ({
      id: item.id, description: item.description, category: item.category, amount: item.amount,
      date: item.date, installmentNumber: item.installmentNumber, installmentTotal: item.installmentTotal,
    })),
    [scheduledInstallments],
  )
  const allPaidExpenses = useMemo(() => [
    ...data.expenses.filter((item) => !convertedExpenseIds.has(item.id)),
    ...paidPlanExpenses,
  ], [convertedExpenseIds, data.expenses, paidPlanExpenses])
  const monthExpenses = useMemo(
    () => allPaidExpenses.filter((item) => item.date.startsWith(selectedMonth)),
    [allPaidExpenses, selectedMonth],
  )
  const monthIncomes = useMemo(
    () => data.incomes.filter((item) => item.date.startsWith(selectedMonth)),
    [data.incomes, selectedMonth],
  )
  const pendingMonthInstallments = scheduledInstallments.filter((item) => item.status === 'planned' && item.date.startsWith(selectedMonth))
  const pendingMonthAmount = pendingMonthInstallments.reduce((sum, item) => sum + item.amount, 0)
  const totalSpent = monthExpenses.reduce((sum, item) => sum + item.amount, 0)
  const totalReceived = monthIncomes.reduce((sum, item) => sum + item.amount, 0)
  const monthBalance = totalReceived - totalSpent
  const monthlyAverage = monthExpenses.length ? totalSpent / monthExpenses.length : 0
  const committedThisMonth = totalSpent + pendingMonthAmount
  const remainingBudget = monthlyBudget ? monthlyBudget.amount - committedThisMonth : null
  const budgetPercent = monthlyBudget ? Math.round((committedThisMonth / monthlyBudget.amount) * 100) : 0
  const budgetState = remainingBudget === null ? 'empty' : remainingBudget < 0 ? 'exceeded' : budgetPercent >= 80 ? 'warning' : 'safe'

  const analysisExpenses = periodFilter === 'all' ? allPaidExpenses : monthExpenses
  const analysisTotal = analysisExpenses.reduce((sum, item) => sum + item.amount, 0)
  const activeInstallments = useMemo(
    () => {
      const automatic: InstallmentPanelItem[] = data.installmentPlans.map((plan) => {
        const entries = scheduleInstallments(plan)
        const pending = entries.filter((item) => item.status === 'planned')
        const latestPaid = [...entries].reverse().find((item) => item.status === 'paid')
        return {
          id: plan.id, planId: plan.id, description: plan.description, category: plan.category,
          amount: plan.amount, installmentNumber: latestPaid?.installmentNumber ?? Math.max(0, plan.firstInstallmentNumber - 1),
          installmentTotal: plan.totalInstallments, remainingCount: pending.length,
          remainingAmount: pending.reduce((sum, item) => sum + item.amount, 0),
          nextDate: pending[0]?.date, automatic: true,
        }
      }).filter((item) => item.remainingCount > 0)
      const legacy: InstallmentPanelItem[] = data.expenses
        .filter((item) => !convertedExpenseIds.has(item.id) && item.installmentNumber && item.installmentTotal && item.installmentNumber < item.installmentTotal)
        .map((item) => ({
          id: item.id, description: item.description, category: item.category, amount: item.amount,
          installmentNumber: item.installmentNumber ?? 1, installmentTotal: item.installmentTotal ?? 1,
          remainingCount: Math.max(0, (item.installmentTotal ?? 0) - (item.installmentNumber ?? 0)),
          remainingAmount: item.amount * Math.max(0, (item.installmentTotal ?? 0) - (item.installmentNumber ?? 0)),
          automatic: false,
        }))
      return [...automatic, ...legacy].sort((a, b) => (a.nextDate ?? '9999-12-31').localeCompare(b.nextDate ?? '9999-12-31'))
    },
    [convertedExpenseIds, data.expenses, data.installmentPlans],
  )
  const remainingInstallmentTotal = activeInstallments.reduce((sum, item) => sum + item.remainingAmount, 0)

  const breakdown = useMemo(() => expenseCategories.map((category) => ({
    ...getCategoryMeta(category),
    total: analysisExpenses.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0),
  })).filter((item) => item.total > 0).sort((a, b) => b.total - a.total), [analysisExpenses, expenseCategories])
  const topCategory = breakdown[0]
  const savingsIdea = getSavingsIdea(topCategory?.label)
  const chartGradient = useMemo(() => {
    if (!breakdown.length || analysisTotal <= 0) return '#e8f0f4 0 100%'
    let cursor = 0
    return breakdown.map((item) => {
      const start = cursor
      cursor += (item.total / analysisTotal) * 100
      return `${item.color} ${start}% ${cursor}%`
    }).join(', ')
  }, [analysisTotal, breakdown])

  const year = Number(selectedMonth.slice(0, 4))
  const yearlyEvolution = useMemo(() => {
    const points = Array.from({ length: 12 }, (_, monthIndex) => {
      const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
      const total = allPaidExpenses.filter((item) => item.date.startsWith(key)).reduce((sum, item) => sum + item.amount, 0)
      const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(year, monthIndex, 1)).replace('.', '')
      return { monthIndex, key, label, total }
    })
    const max = Math.max(...points.map((item) => item.total), 0)
    const total = points.reduce((sum, item) => sum + item.total, 0)
    const biggest = points.reduce((winner, item) => item.total > winner.total ? item : winner, points[0])
    return { points, max, total, biggest }
  }, [allPaidExpenses, year])

  const ledgerRows = useMemo(() => {
    const expenses: LedgerRow[] = data.expenses.filter((item) => !convertedExpenseIds.has(item.id)).map((item) => ({
      id: item.id, type: 'expense', date: item.date, description: item.description,
      category: item.category, amount: item.amount,
      installmentNumber: item.installmentNumber, installmentTotal: item.installmentTotal, status: 'paid',
    }))
    const automatic: LedgerRow[] = scheduledInstallments.map((item) => ({
      id: item.id, planId: item.planId, type: 'expense', date: item.date, description: item.description,
      category: item.category, amount: item.amount, installmentNumber: item.installmentNumber,
      installmentTotal: item.installmentTotal, status: item.status,
    }))
    const incomes: LedgerRow[] = data.incomes.map((item) => ({
      id: item.id, type: 'income', date: item.date, description: item.description,
      category: item.source, amount: item.amount, status: 'paid',
    }))
    const base = [
      ...(periodFilter === 'month' ? [...expenses, ...automatic].filter((item) => item.date.startsWith(selectedMonth)) : [...expenses, ...automatic]),
      ...(periodFilter === 'month' ? incomes.filter((item) => item.date.startsWith(selectedMonth)) : incomes),
    ]
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return base.filter((item) => {
      if (typeFilter === 'expense' && item.type !== 'expense') return false
      if (typeFilter === 'income' && item.type !== 'income') return false
      if (typeFilter === 'installments' && !(item.type === 'expense' && item.installmentTotal && item.installmentNumber)) return false
      if (categoryFilter !== 'Todas' && item.category !== categoryFilter) return false
      if (normalizedQuery && !`${item.description} ${item.category}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery)) return false
      return true
    }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  }, [categoryFilter, convertedExpenseIds, data.expenses, data.incomes, periodFilter, query, scheduledInstallments, selectedMonth, typeFilter])
  const visibleSpent = ledgerRows.filter((item) => item.type === 'expense' && item.status === 'paid').reduce((sum, item) => sum + item.amount, 0)
  const visiblePlanned = ledgerRows.filter((item) => item.type === 'expense' && item.status === 'planned').reduce((sum, item) => sum + item.amount, 0)
  const visibleReceived = ledgerRows.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const hasFilters = Boolean(query || categoryFilter !== 'Todas' || typeFilter !== 'all' || periodFilter !== 'month')

  function resetFilters() {
    setQuery('')
    setCategoryFilter('Todas')
    setTypeFilter('all')
    setPeriodFilter('month')
  }

  function openNewEntry(type: 'expense' | 'income') {
    setEditing(null)
    setNewCategory('')
    setFormError('')
    setForm({
      type,
      description: '',
      category: type === 'expense' ? 'Alimentação' : 'Salário',
      amount: '',
      date: todayKey(),
      installmentsEnabled: false,
      installmentNumber: '1',
      installmentTotal: '2',
      firstInstallmentPaid: false,
    })
    setFormOpen(true)
  }

  function openEditExpense(item: Expense) {
    setEditing({ type: 'expense', id: item.id })
    setNewCategory('')
    setFormError('')
    setForm({
      type: 'expense', description: item.description, category: item.category,
      amount: String(item.amount).replace('.', ','), date: item.date,
      installmentsEnabled: Boolean(item.installmentTotal),
      installmentNumber: String(item.installmentNumber ?? 1),
      installmentTotal: String(item.installmentTotal ?? 2),
      firstInstallmentPaid: true,
    })
    setFormOpen(true)
  }

  function openEditIncome(item: Income) {
    setEditing({ type: 'income', id: item.id })
    setNewCategory('')
    setFormError('')
    setForm({
      type: 'income', description: item.description, category: item.source,
      amount: String(item.amount).replace('.', ','), date: item.date,
      installmentsEnabled: false, installmentNumber: '1', installmentTotal: '2',
      firstInstallmentPaid: false,
    })
    setFormOpen(true)
  }

  function openEditInstallmentPlan(item: InstallmentPlan) {
    setEditing({ type: 'installmentPlan', id: item.id })
    setNewCategory('')
    setFormError('')
    setForm({
      type: 'expense', description: item.description, category: item.category,
      amount: String(item.amount).replace('.', ','), date: item.firstDueDate,
      installmentsEnabled: true, installmentNumber: String(item.firstInstallmentNumber),
      installmentTotal: String(item.totalInstallments),
      firstInstallmentPaid: item.paidInstallments.includes(item.firstInstallmentNumber),
    })
    setFormOpen(true)
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const amount = parseAmount(form.amount)
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.date) {
      setFormError('Preencha a descrição, um valor maior que zero e a data.')
      return
    }
    const installmentNumber = Number(form.installmentNumber)
    const installmentTotal = Number(form.installmentTotal)
    if (form.type === 'expense' && form.installmentsEnabled
      && (!Number.isInteger(installmentNumber) || !Number.isInteger(installmentTotal)
        || installmentTotal < 2 || installmentTotal > 120
        || installmentNumber < 1 || installmentNumber > installmentTotal)) {
      setFormError('Informe uma primeira parcela entre 1 e o total, com total entre 2 e 120.')
      return
    }
    if (form.type === 'expense' && form.category === '__nova' && !newCategory.trim()) {
      setFormError('Digite o nome da nova categoria.')
      return
    }

    try {
      if (form.type === 'expense') {
        const categoryName = form.category === '__nova' ? newCategory.trim() : form.category
        if (!expenseCategories.some((item) => item.toLocaleLowerCase('pt-BR') === categoryName.toLocaleLowerCase('pt-BR'))) {
          const category: CustomCategory = { id: createId(), name: categoryName }
          await saveItem('categories', category)
        }

        if (editing?.type === 'installmentPlan' || (form.installmentsEnabled && (!editing || editing.type === 'expense'))) {
          const previous = editing?.type === 'installmentPlan'
            ? data.installmentPlans.find((item) => item.id === editing.id)
            : undefined
          if (editing?.type === 'installmentPlan' && !previous) {
            setFormError('Este plano não está mais disponível. Feche e atualize a lista antes de editar.')
            return
          }
          const sourceExpense = editing?.type === 'expense'
            ? data.expenses.find((item) => item.id === editing.id)
            : undefined
          const startingPaid = previous?.paidInstallments ?? (sourceExpense?.installmentNumber ? [sourceExpense.installmentNumber] : [])
          const paid = new Set(startingPaid.filter((number) => number >= installmentNumber && number <= installmentTotal))
          if (form.firstInstallmentPaid) paid.add(installmentNumber)
          else paid.delete(installmentNumber)
          const plan: InstallmentPlan = {
            id: previous?.id ?? createId(), description: form.description.trim(), category: categoryName,
            amount, firstDueDate: form.date, firstInstallmentNumber: installmentNumber,
            totalInstallments: installmentTotal, paidInstallments: [...paid].sort((a, b) => a - b),
            ...((previous?.sourceExpenseId ?? sourceExpense?.id) ? { sourceExpenseId: previous?.sourceExpenseId ?? sourceExpense?.id } : {}),
          }
          await saveItem('installmentPlans', plan)
          if (sourceExpense) await removeItem('expenses', sourceExpense.id)
        } else {
          const expense: Expense = {
            id: editing?.type === 'expense' ? editing.id : createId(),
            description: form.description.trim(), category: categoryName, amount, date: form.date,
            ...(form.installmentsEnabled ? { installmentNumber, installmentTotal } : {}),
          }
          await saveItem('expenses', expense)
        }
      } else {
        const income: Income = {
          id: editing?.type === 'income' ? editing.id : createId(),
          description: form.description.trim(), source: form.category || 'Outros', amount, date: form.date,
        }
        await saveItem('incomes', income)
      }
      setFormOpen(false)
      setEditing(null)
      setNewCategory('')
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  async function setInstallmentPaid(planId: string, installmentNumber: number, paid: boolean) {
    const plan = data.installmentPlans.find((item) => item.id === planId)
    if (!plan) return
    const paidSet = new Set(plan.paidInstallments)
    if (paid) paidSet.add(installmentNumber)
    else paidSet.delete(installmentNumber)
    try {
      await saveItem('installmentPlans', { ...plan, paidInstallments: [...paidSet].sort((a, b) => a - b) })
    } catch (error) { setImportMessage(errorMessage(error)) }
  }

  async function deleteInstallmentPlan(plan: InstallmentPlan) {
    const schedule = scheduleInstallments(plan)
    const paidCount = schedule.filter((item) => item.status === 'paid').length
    const pendingCount = schedule.length - paidCount
    if (!window.confirm(`Excluir “${plan.description}” e todas as ${schedule.length} parcelas dos meses correspondentes? Isso removerá ${paidCount} paga(s) e ${pendingCount} prevista(s).`)) return
    try { await removeItem('installmentPlans', plan.id) }
    catch (error) { setImportMessage(errorMessage(error)) }
  }

  async function deleteEntry(item: LedgerRow) {
    if (item.planId) {
      const plan = data.installmentPlans.find((entry) => entry.id === item.planId)
      if (plan) await deleteInstallmentPlan(plan)
      return
    }
    if (!window.confirm(`Excluir “${item.description}”?`)) return
    try {
      await removeItem(item.type === 'expense' ? 'expenses' : 'incomes', item.id)
    } catch (error) {
      setImportMessage(errorMessage(error))
    }
  }

  async function saveMonthlyBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBudgetError('')
    const amount = parseAmount(budgetDraft)
    if (!Number.isFinite(amount) || amount <= 0) {
      setBudgetError('Informe um limite mensal maior que zero.')
      return
    }
    const budget: MonthlyBudget = { id: monthlyBudget?.id ?? selectedMonth, month: selectedMonth, amount }
    try { await saveItem('budgets', budget) }
    catch (error) { setBudgetError(errorMessage(error)) }
  }

  async function clearMonthlyBudget() {
    if (!monthlyBudget) return
    try {
      await removeItem('budgets', monthlyBudget.id)
      setBudgetDraft('')
      setBudgetError('')
    } catch (error) { setBudgetError(errorMessage(error)) }
  }

  async function saveCustomCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = categoryDraft.trim()
    if (!name || name.length > 32) { setCategoryError('Use um nome com até 32 caracteres.'); return }
    if (expenseCategories.some((item) => item.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
      setCategoryError('Essa categoria já existe.')
      return
    }
    try {
      await saveItem('categories', { id: createId(), name })
      setCategoryDraft('')
      setCategoryError('')
      setCategoryModalOpen(false)
    } catch (error) { setCategoryError(errorMessage(error)) }
  }

  async function importExpenseFile(file?: File) {
    if (!file) return
    setImportMessage('')
    try {
      const { items, ignored } = parseExpenseCsv(await file.text(), allPaidExpenses)
      if (!items.length) {
        setImportMessage(`Nenhuma despesa nova para importar${ignored ? `; ${ignored} linha(s) duplicada(s) ou inválida(s) ignorada(s).` : '.'}`)
        return
      }
      const newNames = [...new Set(items.map((item) => item.category))]
        .filter((name) => !expenseCategories.some((category) => category.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR')))
      for (const name of newNames) await saveItem('categories', { id: createId(), name })
      for (let index = 0; index < items.length; index += 25) {
        await Promise.all(items.slice(index, index + 25).map((item) => saveItem('expenses', item)))
      }
      setPeriodFilter('all')
      setTypeFilter('expense')
      setImportMessage(`${items.length} despesa(s) importada(s)${ignored ? `; ${ignored} duplicada(s) ou inválida(s) ignorada(s).` : '.'}`)
    } catch (error) { setImportMessage(`Não foi possível importar o CSV: ${errorMessage(error)}`) }
  }

  async function importIncomeFile(file?: File) {
    if (!file) return
    setImportMessage('')
    try {
      const { items, ignored } = parseIncomeCsv(await file.text(), data.incomes)
      if (!items.length) {
        setImportMessage(`Nenhum recebimento novo para importar${ignored ? `; ${ignored} linha(s) duplicada(s) ou inválida(s) ignorada(s).` : '.'}`)
        return
      }
      for (let index = 0; index < items.length; index += 25) {
        await Promise.all(items.slice(index, index + 25).map((item) => saveItem('incomes', item)))
      }
      setPeriodFilter('all')
      setTypeFilter('income')
      setImportMessage(`${items.length} recebimento(s) importado(s)${ignored ? `; ${ignored} duplicado(s) ou inválido(s) ignorado(s).` : '.'}`)
    } catch (error) { setImportMessage(`Não foi possível importar o CSV: ${errorMessage(error)}`) }
  }

  function changeMonth(direction: number) {
    setSelectedMonth((current) => shiftMonth(current, direction))
    setPeriodFilter('month')
  }

  const filteredExpenseRows = ledgerRows.filter((item) => item.type === 'expense')
  const exportExpenseRows = filteredExpenseRows.filter((item) => item.status === 'paid')
  const filteredIncomeRows = ledgerRows.filter((item) => item.type === 'income')
  const todayIsSelected = selectedMonth === currentMonthKey()

  return (
    <main className="page-wrap finance-page">
      <div className="page-heading finance-page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" />CONTROLE FINANCEIRO</div>
          <h1>Seu dinheiro,<br /><em>em ordem.</em></h1>
          <p>Veja o que entrou, o que saiu e quanto ainda cabe no seu mês.</p>
        </div>
        <div className="finance-heading-actions">
          <button className="ghost-button finance-income-cta" type="button" onClick={() => openNewEntry('income')}><ArrowUpRight size={15} />Adicionar recebimento</button>
          <button className="primary-button" type="button" onClick={() => openNewEntry('expense')}><Plus size={16} />Nova despesa</button>
        </div>
      </div>

      <section className="finance-month-toolbar" aria-label="Selecionar mês">
        <div className="finance-month-control">
          <button className="finance-month-arrow" type="button" aria-label="Mês anterior" onClick={() => changeMonth(-1)}><ArrowLeft size={17} /></button>
          <CalendarDays size={17} />
          <strong>{monthLabel(selectedMonth)}</strong>
          <button className="finance-month-arrow" type="button" aria-label="Próximo mês" onClick={() => changeMonth(1)}><ArrowRight size={17} /></button>
        </div>
        {!todayIsSelected && <button className="finance-today-button" type="button" onClick={() => { setSelectedMonth(currentMonthKey()); setPeriodFilter('month') }}>Voltar para este mês</button>}
      </section>

      <section className="finance-metrics" aria-label="Resumo do mês">
        <FinanceMetric title="Recebido neste mês" value={currency.format(totalReceived)} detail={`${monthIncomes.length} recebimento(s) registrado(s)`} tone="green" icon={ArrowUpRight} />
        <FinanceMetric title="Gasto neste mês" value={currency.format(totalSpent)} detail={`${monthExpenses.length} despesa(s) · média ${currency.format(monthlyAverage)}`} tone="pink" icon={WalletCards} />
        <FinanceMetric title="Saldo recebido − gasto" value={currency.format(monthBalance)} detail={monthBalance < 0 ? 'As despesas passaram do que entrou neste mês' : 'Recebimentos menos despesas registradas'} tone={monthBalance < 0 ? 'pink' : 'blue'} icon={TrendingUp} />
        <FinanceMetric title="Maior categoria" value={topCategory?.label || '—'} detail={topCategory ? `${currency.format(topCategory.total)} no período analisado` : 'Ainda sem dados'} tone="lavender" icon={BarChart3} />
      </section>

      <section className={`finance-budget-panel finance-budget-${budgetState}`} aria-label="Limite mensal de gastos">
        <div className="finance-budget-main">
          <div className="finance-budget-heading">
            <span className="finance-budget-icon"><PiggyBank size={20} /></span>
            <div><span className="section-kicker">Planejamento mensal</span><h2>Quanto ainda posso gastar?</h2><p>O limite fica separado do saldo recebido para você enxergar os dois com clareza.</p></div>
          </div>
          {monthlyBudget ? (
            <div className="finance-budget-progress">
              <div className="finance-budget-progress-top"><span>{budgetPercent}% do limite comprometido</span><strong>{currency.format(totalSpent)} gasto + {currency.format(pendingMonthAmount)} previsto</strong></div>
              <div className="finance-budget-track"><span style={{ width: `${Math.min(budgetPercent, 100)}%` }} /></div>
              <div className="finance-budget-status">
                {remainingBudget !== null && remainingBudget < 0
                  ? <><AlertTriangle size={15} /><span>Gastos e parcelas previstas ultrapassam o limite em <strong>{currency.format(Math.abs(remainingBudget))}</strong>.</span></>
                  : remainingBudget !== null && budgetPercent >= 80
                    ? <><AlertTriangle size={15} /><span>Atenção: após as parcelas previstas, ainda pode gastar <strong>{currency.format(remainingBudget)}</strong>.</span></>
                    : remainingBudget !== null
                      ? <><span className="finance-status-check">✓</span><span>Ainda pode gastar <strong>{currency.format(remainingBudget)}</strong> neste mês, descontadas as parcelas previstas.</span></>
                      : null}
              </div>
            </div>
          ) : (
            <p className="finance-budget-no-limit">Defina um limite para acompanhar quanto ainda cabe no orçamento. Neste mês há <strong>{currency.format(pendingMonthAmount)}</strong> em parcelas previstas; o saldo de entradas menos gastos pagos é <strong>{currency.format(monthBalance)}</strong>.</p>
          )}
        </div>
        <form className="finance-budget-form" onSubmit={(event) => void saveMonthlyBudget(event)}>
          <label htmlFor="finance-monthly-budget">Limite de gastos do mês</label>
          <div className="finance-budget-input"><span>R$</span><input id="finance-monthly-budget" inputMode="decimal" value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} placeholder="3.000,00" /></div>
          <div className="finance-budget-actions"><button className="small-primary" type="submit">Salvar limite</button>{monthlyBudget && <button className="finance-clear-limit" type="button" onClick={() => void clearMonthlyBudget()}>Remover</button>}</div>
          {budgetError && <span className="inline-error">{budgetError}</span>}
        </form>
      </section>

      <div className="finance-layout">
        <div className="finance-main-column">
          <section className="panel finance-ledger-panel" id="lancamentos">
            <div className="panel-heading finance-ledger-heading">
              <div><span className="section-kicker">Movimentações</span><h2>Gastos e recebimentos</h2><p className="finance-panel-subtitle">{periodFilter === 'month' ? monthLabel(selectedMonth) : 'Todo o histórico'}</p></div>
              <div className="finance-ledger-actions">
                <label className="ghost-button import-button finance-file-button"><ArrowDownToLine size={14} />Importar gastos<input type="file" accept=".csv,text/csv" aria-label="Importar gastos em CSV" onChange={(event) => { void importExpenseFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} /></label>
                <label className="ghost-button import-button finance-file-button"><ArrowDownToLine size={14} />Importar recebimentos<input type="file" accept=".csv,text/csv" aria-label="Importar recebimentos em CSV" onChange={(event) => { void importIncomeFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} /></label>
                <button className="ghost-button finance-file-button" type="button" disabled={!exportExpenseRows.length} onClick={() => downloadExpensesCsv(exportExpenseRows)}><Download size={14} />CSV gastos pagos</button>
                <button className="ghost-button finance-file-button" type="button" disabled={!filteredIncomeRows.length} onClick={() => downloadIncomesCsv(filteredIncomeRows.map((item) => ({ id: item.id, description: item.description, source: item.category, amount: item.amount, date: item.date })))}><Download size={14} />CSV recebimentos</button>
              </div>
            </div>
            {importMessage && <p className="import-message" role="status">{importMessage}</p>}
            <div className="finance-filters">
              <label className="search-wrap"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar descrição ou origem" aria-label="Buscar lançamentos" /></label>
              <label className="select-wrap"><Filter size={14} /><select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as 'month' | 'all')} aria-label="Filtrar período"><option value="month">Mês selecionado</option><option value="all">Todos os períodos</option></select><ChevronDown size={13} /></label>
              <label className="select-wrap"><Tags size={14} /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar categoria"><option value="Todas">Todas categorias</option>{filterCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select><ChevronDown size={13} /></label>
            </div>
            <div className="finance-filter-tabs" role="group" aria-label="Tipo de lançamento">
              <button className={typeFilter === 'all' ? 'selected' : ''} type="button" onClick={() => setTypeFilter('all')}>Tudo</button>
              <button className={typeFilter === 'expense' ? 'selected' : ''} type="button" onClick={() => setTypeFilter('expense')}>Gastos</button>
              <button className={typeFilter === 'income' ? 'selected' : ''} type="button" onClick={() => setTypeFilter('income')}>Recebimentos</button>
              <button className={typeFilter === 'installments' ? 'selected' : ''} type="button" onClick={() => setTypeFilter('installments')}>Parcelados</button>
              {hasFilters && <button className="finance-reset-filter" type="button" onClick={resetFilters}>Limpar filtros <X size={12} /></button>}
            </div>
            <div className="finance-list-summary"><span>{ledgerRows.length} {ledgerRows.length === 1 ? 'lançamento' : 'lançamentos'}</span><span><b className="finance-in-text">Entradas {currency.format(visibleReceived)}</b><b className="finance-out-text">Gasto pago {currency.format(visibleSpent)}</b>{visiblePlanned > 0 && <b className="finance-plan-text">Previsto {currency.format(visiblePlanned)}</b>}</span></div>
            <div className="expense-list finance-ledger-list">
              {ledgerRows.length ? ledgerRows.map((item) => {
                const CategoryIcon = item.type === 'expense' ? getCategoryMeta(item.category).icon : ArrowUpRight
                const plan = item.planId ? data.installmentPlans.find((entry) => entry.id === item.planId) : undefined
                const remainingCount = item.type === 'expense' && item.installmentTotal && item.installmentNumber
                  ? Math.max(0, item.installmentTotal - item.installmentNumber) : 0
                const remainingAmount = item.amount * remainingCount
                return (
                  <article className={`expense-row finance-ledger-row finance-ledger-${item.type}${item.status === 'planned' ? ' finance-ledger-planned' : ''}`} key={`${item.type}:${item.id}`}>
                    <time className="expense-date finance-ledger-date">{formatDate(item.date)}</time>
                    <span className={`expense-icon finance-ledger-icon finance-icon-${item.type}`}><CategoryIcon size={16} /></span>
                    <span className="expense-description finance-ledger-description"><strong>{item.description}</strong><small>{item.type === 'income' ? `Recebido · ${item.category}` : item.category}</small>
                      {item.planId && item.installmentNumber && <small className="finance-installment-detail">Parcela {item.installmentNumber}/{item.installmentTotal} · {item.status === 'planned' ? 'prevista' : 'paga'} · <button className="finance-installment-toggle" type="button" onClick={() => void setInstallmentPaid(item.planId!, item.installmentNumber!, item.status !== 'paid')}>{item.status === 'planned' ? 'Marcar como paga' : 'Desfazer pagamento'}</button></small>}
                      {item.type === 'expense' && !item.planId && item.installmentTotal && item.installmentNumber && <small className="finance-installment-detail">Parcela {item.installmentNumber}/{item.installmentTotal} · faltam {remainingCount}{remainingCount ? ` · ${currency.format(remainingAmount)} restantes` : ' · última parcela'}</small>}
                    </span>
                    <strong className={`expense-amount finance-ledger-amount finance-amount-${item.type}${item.status === 'planned' ? ' finance-amount-planned' : ''}`}>{item.type === 'income' ? '+' : item.status === 'planned' ? '~' : '−'} {currency.format(item.amount)}</strong>
                    <span className="row-actions finance-row-actions">
                      <button className="icon-button" type="button" aria-label={plan ? `Editar todas as parcelas de ${item.description}` : `Editar ${item.description}`} onClick={() => {
                        if (plan) openEditInstallmentPlan(plan)
                        else if (item.type === 'expense') openEditExpense({ id: item.id, description: item.description, category: item.category, amount: item.amount, date: item.date, installmentNumber: item.installmentNumber, installmentTotal: item.installmentTotal })
                        else openEditIncome({ id: item.id, description: item.description, source: item.category, amount: item.amount, date: item.date })
                      }}><Pencil size={14} /></button>
                      <button className="icon-button danger-hover" type="button" aria-label={plan ? `Excluir o plano de parcelas de ${item.description}` : `Excluir ${item.description}`} onClick={() => void deleteEntry(item)}><Trash2 size={14} /></button>
                    </span>
                  </article>
                )
              }) : <div className="empty-state"><span className="empty-icon"><Search size={19} /></span><strong>Nenhum lançamento neste filtro</strong><p>Registre um gasto ou recebimento, ou ajuste os filtros.</p><button className="ghost-button" type="button" onClick={() => openNewEntry(typeFilter === 'income' ? 'income' : 'expense')}><Plus size={14} />Adicionar lançamento</button></div>}
            </div>
            <footer className="finance-ledger-footer"><span>{ledgerRows.length} {ledgerRows.length === 1 ? 'resultado' : 'resultados'}</span><span>Saldo recebido − pago <strong>{currency.format(visibleReceived - visibleSpent)}</strong>{visiblePlanned > 0 && <> · previsto <strong>{currency.format(visiblePlanned)}</strong></>}</span></footer>
          </section>

          <section className="panel finance-evolution-panel" id="evolucao">
            <div className="panel-heading finance-evolution-heading"><div><span className="section-kicker">Ritmo do ano</span><h2>Evolução mensal</h2><p className="finance-panel-subtitle">Compare os gastos mês a mês em {year}.</p></div><div className="finance-year-total"><span><TrendingUp size={14} /> Total no ano</span><strong>{currency.format(yearlyEvolution.total)}</strong></div></div>
            <div className="finance-evolution-chart" role="img" aria-label={`Gastos mês a mês em ${year}`}>
              {yearlyEvolution.points.map((point) => <button className={`finance-month-bar-column${point.key === selectedMonth ? ' selected' : ''}`} key={point.key} type="button" title={`${point.label}: ${currency.format(point.total)}`} aria-label={`${point.label}: ${currency.format(point.total)}`} onClick={() => { setSelectedMonth(point.key); setPeriodFilter('month') }}>
                <span className="finance-bar-value">{point.total > 0 ? currency.format(point.total).replace(',00', '') : ''}</span>
                <span className="finance-month-bar-track"><span style={{ height: yearlyEvolution.max ? `${Math.max((point.total / yearlyEvolution.max) * 100, point.total ? 5 : 0)}%` : '0%' }} /></span>
                <span className="finance-month-label">{point.label}</span>
              </button>)}
            </div>
            <div className="finance-evolution-footer"><span>Mês selecionado: <strong>{monthLabel(selectedMonth)}</strong></span><span>Maior gasto: <strong>{yearlyEvolution.biggest.total ? `${yearlyEvolution.biggest.label} · ${currency.format(yearlyEvolution.biggest.total)}` : 'Ainda sem dados'}</strong></span></div>
          </section>

          <section className="finance-savings-section" id="ideias">
            <div className="finance-savings-heading"><div><span className="section-kicker">Pequenos passos</span><h2>Ideias para economizar</h2><p>Sem culpa e sem fórmula mágica — só escolhas que combinam com a sua rotina.</p></div><span className="finance-savings-mark"><Sparkles size={17} /></span></div>
            <div className="finance-savings-grid">
              <article className="finance-savings-card finance-savings-featured"><span className="finance-savings-label">Dica para {monthLabel(selectedMonth).toLocaleLowerCase('pt-BR')} · {topCategory?.label || 'comece por aqui'}</span><h3>{savingsIdea.title}</h3><p>{savingsIdea.text}</p><small>A categoria que mais pesa merece o primeiro carinho.</small></article>
              <article className="finance-savings-card"><span className="finance-savings-number">01</span><h3>Faça um encontro semanal</h3><p>Reserve 10 minutos para conferir os lançamentos e escolher um ajuste pequeno para a próxima semana.</p></article>
              <article className="finance-savings-card"><span className="finance-savings-number">02</span><h3>Dê nome ao que você quer</h3><p>Uma meta fica mais clara quando tem destino: viagem, tranquilidade, casa ou um sonho só seu.</p></article>
            </div>
          </section>
        </div>

        <aside className="finance-side-column">
          <section className="panel finance-category-panel" id="categorias">
            <div className="panel-heading finance-side-heading"><div><span className="section-kicker">Onde vai o dinheiro</span><h2>Por categoria</h2></div><button className="ghost-button finance-category-add" type="button" onClick={() => { setCategoryDraft(''); setCategoryError(''); setCategoryModalOpen(true) }}><Plus size={13} />Categoria</button></div>
            <div className="finance-category-chart"><div className="finance-donut" style={{ background: `conic-gradient(${chartGradient})` }}><div><span>Total</span><strong>{currency.format(analysisTotal)}</strong></div></div></div>
            <div className="finance-category-legend">{breakdown.length ? breakdown.map((item) => <div className="finance-legend-row" key={item.label}><span><i style={{ background: item.color }} />{item.label}</span><strong>{currency.format(item.total)}<small>{analysisTotal ? Math.round((item.total / analysisTotal) * 100) : 0}%</small></strong></div>) : <p className="finance-legend-empty">Adicione despesas para ver a distribuição por categoria.</p>}</div>
            <div className="finance-category-insight"><Sparkles size={15} /><p>{topCategory ? `${topCategory.label} representa ${Math.round((topCategory.total / analysisTotal) * 100)}% dos gastos analisados.` : 'Seu próximo lançamento já pode aparecer aqui.'}</p></div>
          </section>

          <section className="panel finance-installments-panel">
            <div className="panel-heading finance-side-heading"><div><span className="section-kicker">Compras parceladas</span><h2>Parcelas em andamento</h2></div><span className="finance-installment-count">{activeInstallments.length}</span></div>
            <div className="finance-installment-total"><span>Saldo futuro estimado</span><strong>{currency.format(remainingInstallmentTotal)}</strong></div>
            {activeInstallments.length ? <div className="finance-installment-list">{activeInstallments.slice(0, 8).map((item) => {
              const plan = item.planId ? data.installmentPlans.find((entry) => entry.id === item.planId) : undefined
              return <article className="finance-installment-row" key={item.id}><span className="finance-installment-icon"><CreditCard size={15} /></span><div><strong>{item.description}</strong><small>{item.category} · {item.automatic ? 'plano mensal automático' : `parcela ${item.installmentNumber}/${item.installmentTotal} (lançamento antigo)`}</small><small>{item.automatic && item.nextDate ? `Próxima: ${formatDate(item.nextDate)} · ` : ''}faltam {item.remainingCount} {item.remainingCount === 1 ? 'parcela' : 'parcelas'}</small>{plan && <span className="finance-installment-plan-actions"><button type="button" onClick={() => openEditInstallmentPlan(plan)}>Editar todas</button><button type="button" onClick={() => void deleteInstallmentPlan(plan)}>Excluir plano</button></span>}</div><b>{currency.format(item.remainingAmount)}</b></article>
            })}</div> : <div className="finance-installment-empty"><CreditCard size={20} /><strong>Sem parcelas em andamento</strong><span>Ao registrar uma despesa parcelada, as parcelas dos próximos meses serão criadas automaticamente.</span></div>}
            <p className="finance-installment-note">Os planos automáticos aparecem uma vez por mês e saem do saldo previsto quando marcados como pagos. O CSV antigo pode mostrar estimativa por lançamento individual.</p>
          </section>
        </aside>
      </div>

      {formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false) }}><section className="modal-card finance-modal" role="dialog" aria-modal="true" aria-labelledby="finance-entry-title">
        <div className="modal-heading"><div><span className="section-kicker">{editing ? 'Atualizar lançamento' : 'Novo lançamento'}</span><h2 id="finance-entry-title">{form.type === 'income' ? (editing ? 'Editar recebimento' : 'Adicionar recebimento') : editing?.type === 'installmentPlan' ? 'Editar plano de parcelas' : (editing ? 'Editar despesa' : 'Adicionar despesa')}</h2></div><button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Fechar"><X size={18} /></button></div>
        <form className="form-stack" onSubmit={(event) => void saveEntry(event)}>
          <label>{form.type === 'income' ? 'De onde veio?' : 'O que foi?'}<input autoFocus value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={form.type === 'income' ? 'Ex.: Salário de outubro' : 'Ex.: Mercado da semana'} maxLength={120} /></label>
          <div className="form-two"><label>{form.type === 'income' ? 'Valor recebido (R$)' : form.installmentsEnabled ? 'Valor da parcela (R$)' : 'Valor (R$)'}<input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0,00" /></label><label>{form.installmentsEnabled ? 'Vencimento da primeira parcela' : 'Data'}<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label></div>
          {form.type === 'income' ? <label>Origem<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}</select></label> : <>
            <label>Categoria<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}<option value="__nova">+ Criar categoria personalizada</option></select></label>
            {form.category === '__nova' && <label>Nome da nova categoria<input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Ex.: Pets, viagem, estudos" maxLength={32} /></label>}
            <label className="check-label"><input type="checkbox" checked={form.installmentsEnabled} disabled={editing?.type === 'installmentPlan'} onChange={(event) => setForm({ ...form, installmentsEnabled: event.target.checked })} /><span>Esta despesa é parcelada</span></label>
            {form.installmentsEnabled && <div className="form-two"><label>Primeira parcela cadastrada<input type="number" min="1" max="120" value={form.installmentNumber} onChange={(event) => setForm({ ...form, installmentNumber: event.target.value })} /></label><label>Total de parcelas<input type="number" min="2" max="120" value={form.installmentTotal} onChange={(event) => setForm({ ...form, installmentTotal: event.target.value })} /></label><label className="check-label finance-first-paid"><input type="checkbox" checked={form.firstInstallmentPaid} onChange={(event) => setForm({ ...form, firstInstallmentPaid: event.target.checked })} /><span>A primeira parcela já foi paga</span></label><p className="finance-installment-form-note">As parcelas a partir do número informado serão criadas automaticamente nos meses seguintes. As previstas reduzem o valor livre; só contam como gasto depois de marcadas como pagas.</p></div>}
          </>}
          {formError && <p className="inline-error" role="alert">{formError}</p>}
          <button className="primary-button form-submit" type="submit"><Plus size={15} />{editing ? 'Salvar alterações' : form.type === 'income' ? 'Salvar recebimento' : 'Salvar despesa'}</button>
        </form>
      </section></div>}

      {categoryModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCategoryModalOpen(false) }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="finance-category-title">
        <div className="modal-heading"><div><span className="section-kicker">Organize do seu jeito</span><h2 id="finance-category-title">Nova categoria</h2></div><button className="icon-button" type="button" onClick={() => setCategoryModalOpen(false)} aria-label="Fechar"><X size={18} /></button></div>
        <form className="form-stack" onSubmit={(event) => void saveCustomCategory(event)}><label>Nome da categoria<input autoFocus value={categoryDraft} onChange={(event) => { setCategoryDraft(event.target.value); setCategoryError('') }} placeholder="Ex.: Pets, viagem, estudos" maxLength={32} /></label>{categoryError && <p className="inline-error" role="alert">{categoryError}</p>}<p className="finance-category-help">A categoria aparecerá nos próximos gastos, filtros e gráficos. As categorias que já têm lançamentos continuam preservadas.</p><button className="primary-button form-submit" type="submit"><Plus size={15} />Criar categoria</button></form>
      </section></div>}
    </main>
  )
}

export default FinanceView
