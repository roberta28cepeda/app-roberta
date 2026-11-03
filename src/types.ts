export type Expense = {
  id: string
  description: string
  category: string
  amount: number
  date: string
  installmentNumber?: number
  installmentTotal?: number
}

export type InstallmentPlan = {
  id: string
  description: string
  category: string
  amount: number
  firstDueDate: string
  firstInstallmentNumber: number
  totalInstallments: number
  paidInstallments: number[]
  sourceExpenseId?: string
}

export type Income = {
  id: string
  description: string
  source: string
  amount: number
  date: string
}

export type MonthlyBudget = {
  id: string
  month: string
  amount: number
}

export type Goal = {
  id: string
  title: string
  description: string
  current: number
  target: number
  unit: string
  dueDate: string
  createdAt: string
}

export type Task = {
  id: string
  title: string
  dueDate: string
  priority: 'Baixa' | 'Normal' | 'Alta'
  status: 'Pendente' | 'Concluída'
  planId: string
  createdAt: string
}

export type Plan = {
  id: string
  title: string
  description: string
  startDate: string
  endDate: string
  status: 'Ativo' | 'Pausado' | 'Concluído'
  createdAt: string
}

export type DailyNote = {
  id: string
  date: string
  text: string
  updatedAt: string
}

export type WishlistAttachment = {
  id: string
  name: string
  dataUrl: string
}

export type WishlistItem = {
  id: string
  title: string
  notes: string
  estimatedPrice: number | null
  status: 'Quero comprar' | 'Comprado'
  attachments: WishlistAttachment[]
  createdAt: string
}

export type ReadingBook = {
  id: string
  title: string
  author: string
  status: 'Quero ler' | 'Lendo' | 'Lido'
  currentPage: number
  totalPages: number
  notes: string
  createdAt: string
}

export type RestockItem = {
  id: string
  name: string
  quantity: string
  notes: string
  neededMonth: string
  completed: boolean
  createdAt: string
}

export type WorkoutExercise = {
  name: string
  sets: number
  reps: number
  load: string
}

export type WorkoutRoutine = {
  id: string
  name: string
  dayOfWeek: number
  exercises: WorkoutExercise[]
  createdAt: string
  lastCompletedAt: string
}

export type WorkoutLog = {
  id: string
  routineId: string
  routineName: string
  date: string
  notes: string
}

export type CustomCategory = {
  id: string
  name: string
}

export type RecurringItem = {
  id: string
  kind: 'expense' | 'income'
  description: string
  category: string
  amount: number
  dayOfMonth: number
  startMonth: string
  active: boolean
  lastGenerated: string
  createdAt: string
}

export type AppRecord = RecurringItem | Expense | InstallmentPlan | Income | MonthlyBudget | Goal | Task | Plan | DailyNote | WishlistItem | ReadingBook | RestockItem | WorkoutRoutine | WorkoutLog | CustomCategory
export type CollectionName = 'expenses' | 'installmentPlans' | 'incomes' | 'budgets' | 'goals' | 'tasks' | 'plans' | 'dailyNotes' | 'wishlist' | 'books' | 'restockItems' | 'workouts' | 'workoutLogs' | 'categories' | 'recurring'

export type LifeData = {
  expenses: Expense[]
  installmentPlans: InstallmentPlan[]
  incomes: Income[]
  budgets: MonthlyBudget[]
  goals: Goal[]
  tasks: Task[]
  plans: Plan[]
  dailyNotes: DailyNote[]
  wishlist: WishlistItem[]
  books: ReadingBook[]
  restockItems: RestockItem[]
  workouts: WorkoutRoutine[]
  workoutLogs: WorkoutLog[]
  categories: CustomCategory[]
  recurring: RecurringItem[]
}

export const COLLECTION_NAMES: CollectionName[] = [
  'expenses', 'installmentPlans', 'incomes', 'budgets', 'goals', 'tasks', 'plans', 'dailyNotes', 'wishlist', 'books', 'restockItems', 'workouts', 'workoutLogs', 'categories', 'recurring',
]

export function emptyLifeData(): LifeData {
  return {
    expenses: [], installmentPlans: [], incomes: [], budgets: [], goals: [], tasks: [], plans: [],
    dailyNotes: [], wishlist: [], books: [], restockItems: [], workouts: [], workoutLogs: [], categories: [], recurring: [],
  }
}
