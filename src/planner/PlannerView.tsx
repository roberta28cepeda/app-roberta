import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  BookOpen, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  ImagePlus, NotebookPen, Package, Pencil, Plus, ShoppingBag, Target, Trash2, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
  AppRecord, CollectionName, DailyNote, LifeData, Plan,
  ReadingBook, RestockItem, Task, WishlistAttachment, WishlistItem,
} from '../types'
import { scheduleInstallments } from '../finance/installments'
import { MAX_WISHLIST_ATTACHMENTS, compressWishlistImage } from './imageAttachments'
import './PlannerView.css'

type PlannerViewProps = {
  data: LifeData
  saveItem: (name: CollectionName, item: AppRecord) => Promise<void>
  removeItem: (name: CollectionName, id: string) => Promise<void>
}

type PlannerTab = 'today' | 'calendar' | 'shopping' | 'reading' | 'restock'
type CalendarEvent = { id: string; date: string; title: string; type: 'task' | 'plan' | 'goal' | 'workout' | 'installment' | 'restock' | 'note'; detail?: string }

const tabs: { id: PlannerTab; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Hoje', icon: NotebookPen },
  { id: 'calendar', label: 'Calendário', icon: CalendarDays },
  { id: 'shopping', label: 'Quero comprar', icon: ShoppingBag },
  { id: 'reading', label: 'Leitura', icon: BookOpen },
  { id: 'restock', label: 'Reposição', icon: Package },
]
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function id() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthKey(date = new Date()) { return dateKey(date).slice(0, 7) }

function monthTitle(key: string) {
  const date = new Date(`${key}-01T12:00:00`)
  const text = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1)
}

function dayTitle(key: string) {
  const date = new Date(`${key}T12:00:00`)
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

function formatDate(value?: string) {
  if (!value) return 'Sem data'
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? 'Sem data' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date).replace('.', '')
}

function shiftMonth(key: string, amount: number) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseAmount(value: string) {
  const normalized = value.trim().includes(',') ? value.trim().replace(/\./g, '').replace(',', '.') : value.trim()
  return Number(normalized)
}

function errorText(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.' }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card planner-modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><span className="section-kicker">Meu planner</span><h2>{title}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>{children}</section></div>
}

function EmptyCard({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return <div className="planner-empty"><span><Icon size={19} /></span><strong>{title}</strong><p>{detail}</p></div>
}

function PlannerView({ data, saveItem, removeItem }: PlannerViewProps) {
  const today = dateKey()
  const [tab, setTab] = useState<PlannerTab>('today')
  const [selectedDate, setSelectedDate] = useState(today)
  const [calendarMonth, setCalendarMonth] = useState(monthKey())
  const [noteDraft, setNoteDraft] = useState('')
  const [noteMessage, setNoteMessage] = useState('')
  const [pageError, setPageError] = useState('')
  const [taskModal, setTaskModal] = useState(false)
  const [planModal, setPlanModal] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', dueDate: today, priority: 'Normal' as Task['priority'], planId: '' })
  const [planForm, setPlanForm] = useState({ title: '', description: '', startDate: today, endDate: '' })

  const [shoppingModal, setShoppingModal] = useState(false)
  const [shoppingEditId, setShoppingEditId] = useState<string | null>(null)
  const [shoppingForm, setShoppingForm] = useState({ title: '', notes: '', estimatedPrice: '' })
  const [shoppingImages, setShoppingImages] = useState<WishlistAttachment[]>([])
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState('')
  const [previewImage, setPreviewImage] = useState<WishlistAttachment | null>(null)

  const [bookModal, setBookModal] = useState(false)
  const [bookEditId, setBookEditId] = useState<string | null>(null)
  const [bookForm, setBookForm] = useState({ title: '', author: '', status: 'Quero ler' as ReadingBook['status'], currentPage: '0', totalPages: '', notes: '' })
  const [restockModal, setRestockModal] = useState(false)
  const [restockEditId, setRestockEditId] = useState<string | null>(null)
  const [restockMonth, setRestockMonth] = useState(() => shiftMonth(monthKey(), 1))
  const [restockForm, setRestockForm] = useState({ name: '', quantity: '', notes: '', neededMonth: shiftMonth(monthKey(), 1) })

  const diaryDate = tab === 'today' ? today : selectedDate
  const todayNote = data.dailyNotes.find((note) => note.date === diaryDate)
  useEffect(() => { setNoteDraft(todayNote?.text ?? ''); setNoteMessage('') }, [diaryDate, todayNote?.text])

  const tasksByDate = useMemo(() => [...data.tasks]
    .filter((task) => task.status === 'Pendente')
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')), [data.tasks])
  const plansActive = useMemo(() => [...data.plans].sort((a, b) => (a.endDate || '9999').localeCompare(b.endDate || '9999')), [data.plans])

  async function saveDailyNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const existing = data.dailyNotes.find((note) => note.date === diaryDate)
    try {
      if (!noteDraft.trim()) {
        if (existing) await removeItem('dailyNotes', existing.id)
        setNoteMessage('Anotação removida deste dia.')
      } else {
        const note: DailyNote = { id: existing?.id ?? diaryDate, date: diaryDate, text: noteDraft.trim(), updatedAt: new Date().toISOString() }
        await saveItem('dailyNotes', note)
        setNoteMessage('Anotação salva.')
      }
    } catch (error) { setNoteMessage(errorText(error)) }
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!taskForm.title.trim()) { setPageError('Escreva o nome da tarefa.'); return }
    const task: Task = { id: id(), title: taskForm.title.trim(), dueDate: taskForm.dueDate, priority: taskForm.priority, status: 'Pendente', planId: taskForm.planId, createdAt: new Date().toISOString() }
    try { await saveItem('tasks', task); setTaskModal(false); setTaskForm({ title: '', dueDate: selectedDate, priority: 'Normal', planId: '' }); setPageError('') }
    catch (error) { setPageError(errorText(error)) }
  }

  async function toggleTask(task: Task) {
    try { await saveItem('tasks', { ...task, status: task.status === 'Pendente' ? 'Concluída' : 'Pendente' }) }
    catch (error) { setPageError(errorText(error)) }
  }

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!planForm.title.trim()) { setPageError('Escreva o nome do plano.'); return }
    const plan: Plan = { id: id(), title: planForm.title.trim(), description: planForm.description.trim(), startDate: planForm.startDate, endDate: planForm.endDate, status: 'Ativo', createdAt: new Date().toISOString() }
    try { await saveItem('plans', plan); setPlanModal(false); setPlanForm({ title: '', description: '', startDate: today, endDate: '' }); setPageError('') }
    catch (error) { setPageError(errorText(error)) }
  }

  async function togglePlan(plan: Plan) {
    try { await saveItem('plans', { ...plan, status: plan.status === 'Concluído' ? 'Ativo' : 'Concluído' }) }
    catch (error) { setPageError(errorText(error)) }
  }

  function openShopping(item?: WishlistItem) {
    setShoppingEditId(item?.id ?? null)
    setShoppingForm(item ? { title: item.title, notes: item.notes, estimatedPrice: item.estimatedPrice === null ? '' : String(item.estimatedPrice).replace('.', ',') } : { title: '', notes: '', estimatedPrice: '' })
    setShoppingImages(item?.attachments ?? [])
    setImageError('')
    setShoppingModal(true)
  }

  async function addShoppingImages(files: FileList | null) {
    if (!files?.length) return
    const remaining = MAX_WISHLIST_ATTACHMENTS - shoppingImages.length
    if (remaining <= 0) { setImageError(`Você pode anexar até ${MAX_WISHLIST_ATTACHMENTS} prints por item.`); return }
    setImageError('')
    setImageBusy(true)
    try {
      const selected = Array.from(files).slice(0, remaining)
      const compressed: WishlistAttachment[] = []
      for (const file of selected) compressed.push(await compressWishlistImage(file))
      setShoppingImages((current) => [...current, ...compressed].slice(0, MAX_WISHLIST_ATTACHMENTS))
      if (files.length > remaining) setImageError(`Adicionei ${remaining} print(s); o limite por item é ${MAX_WISHLIST_ATTACHMENTS}.`)
    } catch (error) { setImageError(errorText(error)) }
    finally { setImageBusy(false) }
  }

  async function saveShoppingItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = shoppingForm.title.trim()
    const price = shoppingForm.estimatedPrice.trim() ? parseAmount(shoppingForm.estimatedPrice) : null
    if (!title) { setImageError('Escreva o nome do que quer comprar.'); return }
    if (price !== null && (!Number.isFinite(price) || price < 0)) { setImageError('Confira o preço estimado.'); return }
    const existing = data.wishlist.find((item) => item.id === shoppingEditId)
    const item: WishlistItem = {
      id: shoppingEditId ?? id(), title, notes: shoppingForm.notes.trim(), estimatedPrice: price,
      status: existing?.status ?? 'Quero comprar', attachments: shoppingImages,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    try { await saveItem('wishlist', item); setShoppingModal(false); setShoppingEditId(null) }
    catch (error) { setImageError(errorText(error)) }
  }

  async function toggleShoppingItem(item: WishlistItem) {
    try { await saveItem('wishlist', { ...item, status: item.status === 'Quero comprar' ? 'Comprado' : 'Quero comprar' }) }
    catch (error) { setPageError(errorText(error)) }
  }

  async function deleteShoppingItem(item: WishlistItem) {
    if (!window.confirm(`Excluir “${item.title}” da lista?`)) return
    try { await removeItem('wishlist', item.id) }
    catch (error) { setPageError(errorText(error)) }
  }

  function openBook(book?: ReadingBook) {
    setBookEditId(book?.id ?? null)
    setBookForm(book ? { title: book.title, author: book.author, status: book.status, currentPage: String(book.currentPage), totalPages: book.totalPages ? String(book.totalPages) : '', notes: book.notes } : { title: '', author: '', status: 'Quero ler', currentPage: '0', totalPages: '', notes: '' })
    setPageError('')
    setBookModal(true)
  }

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const currentPage = Number(bookForm.currentPage || 0)
    const totalPages = Number(bookForm.totalPages || 0)
    if (!bookForm.title.trim() || !Number.isInteger(currentPage) || currentPage < 0 || !Number.isInteger(totalPages) || totalPages < 0 || (totalPages > 0 && currentPage > totalPages)) {
      setPageError('Confira o título e o progresso do livro.'); return
    }
    const existing = data.books.find((book) => book.id === bookEditId)
    const book: ReadingBook = { id: bookEditId ?? id(), title: bookForm.title.trim(), author: bookForm.author.trim(), status: bookForm.status, currentPage, totalPages, notes: bookForm.notes.trim(), createdAt: existing?.createdAt ?? new Date().toISOString() }
    try { await saveItem('books', book); setBookModal(false); setBookEditId(null); setPageError('') }
    catch (error) { setPageError(errorText(error)) }
  }

  function openRestock(item?: RestockItem) {
    setRestockEditId(item?.id ?? null)
    setRestockForm(item ? { name: item.name, quantity: item.quantity, notes: item.notes, neededMonth: item.neededMonth } : { name: '', quantity: '', notes: '', neededMonth: restockMonth })
    setPageError('')
    setRestockModal(true)
  }

  async function saveRestock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restockForm.name.trim() || !/^\d{4}-\d{2}$/.test(restockForm.neededMonth)) { setPageError('Informe o item e o mês em que precisa repor.'); return }
    const existing = data.restockItems.find((item) => item.id === restockEditId)
    const item: RestockItem = { id: restockEditId ?? id(), name: restockForm.name.trim(), quantity: restockForm.quantity.trim(), notes: restockForm.notes.trim(), neededMonth: restockForm.neededMonth, completed: existing?.completed ?? false, createdAt: existing?.createdAt ?? new Date().toISOString() }
    try { await saveItem('restockItems', item); setRestockModal(false); setRestockEditId(null); setRestockMonth(item.neededMonth); setPageError('') }
    catch (error) { setPageError(errorText(error)) }
  }

  async function toggleRestock(item: RestockItem) {
    try { await saveItem('restockItems', { ...item, completed: !item.completed }) }
    catch (error) { setPageError(errorText(error)) }
  }

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const events: CalendarEvent[] = []
    data.tasks.filter((task) => task.dueDate).forEach((task) => events.push({ id: `task-${task.id}`, date: task.dueDate, title: task.title, type: 'task', detail: task.status }))
    data.plans.filter((plan) => plan.startDate).forEach((plan) => events.push({ id: `plan-${plan.id}`, date: plan.startDate, title: plan.title, type: 'plan', detail: plan.status }))
    data.goals.filter((goal) => goal.dueDate).forEach((goal) => events.push({ id: `goal-${goal.id}`, date: goal.dueDate, title: goal.title, type: 'goal', detail: 'Prazo da meta' }))
    data.dailyNotes.filter((note) => note.text.trim()).forEach((note) => events.push({ id: `note-${note.id}`, date: note.date, title: 'Anotação do dia', type: 'note' }))
    data.workouts.forEach((workout) => {
      const [year, month] = calendarMonth.split('-').map(Number)
      const daysInMonth = new Date(year, month, 0).getDate()
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day)
        if (date.getDay() === workout.dayOfWeek) events.push({ id: `workout-${workout.id}-${day}`, date: dateKey(date), title: workout.name, type: 'workout' })
      }
    })
    data.installmentPlans.flatMap(scheduleInstallments).filter((entry) => entry.date.startsWith(calendarMonth)).forEach((entry) => events.push({ id: `installment-${entry.id}`, date: entry.date, title: entry.description, type: 'installment', detail: `${entry.installmentNumber}/${entry.installmentTotal} · ${entry.status === 'paid' ? 'paga' : 'prevista'}` }))
    data.restockItems.filter((item) => item.neededMonth === calendarMonth && !item.completed).forEach((item) => events.push({ id: `restock-${item.id}`, date: `${item.neededMonth}-01`, title: `Repor: ${item.name}`, type: 'restock', detail: 'Este mês' }))
    return events
  }, [calendarMonth, data.dailyNotes, data.goals, data.installmentPlans, data.plans, data.restockItems, data.tasks, data.workouts])

  const calendarCells = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number)
    const first = new Date(year, month - 1, 1)
    const mondayOffset = (first.getDay() + 6) % 7
    const start = new Date(year, month - 1, 1 - mondayOffset)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
      const key = dateKey(date)
      return { key, day: date.getDate(), sameMonth: key.startsWith(calendarMonth), events: calendarEvents.filter((event) => event.date === key) }
    })
  }, [calendarEvents, calendarMonth])

  const selectedEvents = calendarEvents.filter((event) => event.date === selectedDate)
  const nextMonthKey = shiftMonth(monthKey(), 1)
  const todayOpenTasks = tasksByDate.filter((task) => !task.dueDate || task.dueDate <= today)
  const activePlans = plansActive.filter((plan) => plan.status !== 'Concluído')
  const wishlist = [...data.wishlist].sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === 'Quero comprar' ? -1 : 1))
  const books = [...data.books].sort((a, b) => ({ 'Lendo': 0, 'Quero ler': 1, 'Lido': 2 }[a.status] - ({ 'Lendo': 0, 'Quero ler': 1, 'Lido': 2 }[b.status])))
  const restockList = data.restockItems.filter((item) => item.neededMonth === restockMonth).sort((a, b) => Number(a.completed) - Number(b.completed))

  function openTaskFor(date = selectedDate) { setTaskForm({ title: '', dueDate: date, priority: 'Normal', planId: '' }); setPageError(''); setTaskModal(true) }
  function openPlanForm() { setPlanForm({ title: '', description: '', startDate: today, endDate: '' }); setPageError(''); setPlanModal(true) }

  const headingCopy: Record<PlannerTab, { eyebrow: string; title: ReactNode; description: string; action: string }> = {
    today: { eyebrow: 'UM DIA DE CADA VEZ', title: <>Meu <em>planner.</em></>, description: 'Anote o que importa, organize o dia e deixe espaço para respirar.', action: 'Nova tarefa' },
    calendar: { eyebrow: 'VISÃO DO MÊS', title: <>Meu <em>calendário.</em></>, description: 'Tarefas, metas, treinos e parcelas na mesma visão.', action: 'Nova tarefa' },
    shopping: { eyebrow: 'LISTA DE DESEJOS', title: <>Quero <em>comprar.</em></>, description: 'Guarde ideias, valores e prints para decidir com calma.', action: 'Adicionar item' },
    reading: { eyebrow: 'UM CAPÍTULO DE CADA VEZ', title: <>Minha <em>leitura.</em></>, description: 'Livros que quero ler, estou lendo ou já terminei.', action: 'Adicionar livro' },
    restock: { eyebrow: 'LEMBRETES DE CASA', title: <>Lista de <em>reposição.</em></>, description: 'Anote o que precisa comprar de novo no próximo mês.', action: 'Adicionar item' },
  }
  const heading = headingCopy[tab]
  function primaryAction() {
    if (tab === 'shopping') openShopping()
    else if (tab === 'reading') openBook()
    else if (tab === 'restock') openRestock()
    else openTaskFor(tab === 'calendar' ? selectedDate : today)
  }

  return <main className="page-wrap life-planner-page">
    <div className="page-heading life-planner-heading"><div><div className="eyebrow"><span className="eyebrow-line" />{heading.eyebrow}</div><h1>{heading.title}</h1><p>{heading.description}</p></div><button className="primary-button" type="button" onClick={primaryAction}><Plus size={16} />{heading.action}</button></div>
    <nav className="life-planner-tabs" aria-label="Seções do planner">{tabs.map(({ id: tabId, label, icon: Icon }) => <button className={tab === tabId ? 'active' : ''} type="button" key={tabId} onClick={() => setTab(tabId)}><Icon size={15} /><span>{label}</span></button>)}</nav>
    {pageError && <p className="inline-error planner-page-error" role="alert">{pageError}</p>}

    {tab === 'today' && <section className="life-planner-today">
      <article className="planner-date-card"><div><span className="section-kicker">HOJE</span><h2>{dayTitle(today)}</h2><p>Escolha uma coisa de cada vez. O restante pode esperar.</p></div><span className="planner-date-mark"><NotebookPen size={19} /></span></article>
      <div className="planner-today-grid">
        <section className="panel planner-note-panel"><div className="panel-heading"><div><span className="section-kicker">Seu espaço privado</span><h2>Diário do dia</h2><p className="planner-panel-subtitle">{dayTitle(diaryDate)}</p></div><button className="ghost-button" type="button" onClick={() => { setSelectedDate(today); setCalendarMonth(monthKey()) }}>Hoje</button></div><form className="planner-note-form" onSubmit={(event) => void saveDailyNote(event)}><textarea value={noteDraft} onChange={(event) => { setNoteDraft(event.target.value); setNoteMessage('') }} placeholder="O que está na sua cabeça hoje? Anote ideias, acontecimentos ou algo que queira lembrar…" maxLength={5000} /><div><small>{noteDraft.length}/5000{noteMessage ? ` · ${noteMessage}` : ''}</small><button className="small-primary" type="submit">Salvar anotação</button></div></form></section>
        <section className="panel planner-today-tasks"><div className="panel-heading"><div><span className="section-kicker">Próximos passos</span><h2>Tarefas para hoje <span className="heading-count">{todayOpenTasks.length}</span></h2></div><button className="text-button" type="button" onClick={() => openTaskFor(today)}><Plus size={14} />Adicionar</button></div>{todayOpenTasks.length ? <div className="planner-task-list">{todayOpenTasks.slice(0, 8).map((task) => <div className="planner-task-row" key={task.id}><button className={`planner-task-toggle${task.status === 'Concluída' ? ' done' : ''}`} type="button" aria-label="Concluir tarefa" onClick={() => void toggleTask(task)}>{task.status === 'Concluída' && <Check size={12} />}</button><span><strong>{task.title}</strong><small>{task.dueDate ? formatDate(task.dueDate) : 'Sem prazo'} · {task.priority}</small></span><button className="icon-button danger-hover" type="button" aria-label={`Excluir tarefa ${task.title}`} onClick={() => void removeItem('tasks', task.id)}><Trash2 size={13} /></button></div>)}</div> : <EmptyCard icon={CheckCircle2} title="Nada urgente hoje" detail="Você pode descansar ou anotar um próximo passo." />}</section>
      </div>
      <section className="planner-active-plans"><div className="section-title-row"><div><span className="section-kicker">Intenções que seguem com você</span><h2>Planos ativos</h2></div><button className="ghost-button" type="button" onClick={openPlanForm}><Plus size={14} />Novo plano</button></div>{activePlans.length ? <div className="planner-plan-strip">{activePlans.slice(0, 4).map((plan) => { const linked = data.tasks.filter((task) => task.planId === plan.id); const done = linked.filter((task) => task.status === 'Concluída').length; const progress = linked.length ? Math.round(done / linked.length * 100) : 0; return <article className="planner-plan-card" key={plan.id}><div><span className="planner-plan-icon"><Target size={16} /></span><button className="icon-button danger-hover" type="button" aria-label={`Excluir plano ${plan.title}`} onClick={() => void removeItem('plans', plan.id)}><Trash2 size={13} /></button></div><h3>{plan.title}</h3>{plan.description && <p>{plan.description}</p>}<div className="planner-progress-track"><span style={{ width: `${progress}%` }} /></div><small>{done}/{linked.length} tarefas concluídas{plan.endDate ? ` · até ${formatDate(plan.endDate)}` : ''}</small><button className="text-button" type="button" onClick={() => void togglePlan(plan)}>{plan.status === 'Concluído' ? 'Reabrir plano' : 'Marcar como concluído'}</button></article> })}</div> : <button className="planner-empty-plan" type="button" onClick={openPlanForm}><Plus size={16} /><span><strong>Crie um plano quando quiser</strong><small>Um plano dá contexto às tarefas que caminham juntas.</small></span></button>}</section>
      <div className="planner-quick-links"><button type="button" onClick={() => setTab('calendar')}><CalendarDays size={15} />Abrir calendário</button><button type="button" onClick={() => setTab('shopping')}><ShoppingBag size={15} />Lista de compras</button><button type="button" onClick={() => setTab('reading')}><BookOpen size={15} />Minha leitura</button><button type="button" onClick={() => { setRestockMonth(nextMonthKey); setTab('restock') }}><Package size={15} />Repor no próximo mês</button></div>
    </section>}

    {tab === 'calendar' && <section className="planner-calendar panel"><div className="planner-calendar-toolbar"><div className="planner-month-switch"><button type="button" aria-label="Mês anterior" onClick={() => setCalendarMonth((value) => shiftMonth(value, -1))}><ChevronLeft size={17} /></button><h2>{monthTitle(calendarMonth)}</h2><button type="button" aria-label="Próximo mês" onClick={() => setCalendarMonth((value) => shiftMonth(value, 1))}><ChevronRight size={17} /></button></div><button className="ghost-button" type="button" onClick={() => { setCalendarMonth(monthKey()); setSelectedDate(today) }}>Ir para hoje</button></div><div className="planner-calendar-grid">{weekdayLabels.map((label) => <span className="planner-weekday" key={label}>{label}</span>)}{calendarCells.map((cell) => <button className={`planner-calendar-day${cell.sameMonth ? '' : ' outside'}${cell.key === selectedDate ? ' chosen' : ''}${cell.key === today ? ' current' : ''}`} type="button" key={cell.key} onClick={() => { setSelectedDate(cell.key); if (!cell.sameMonth) setCalendarMonth(cell.key.slice(0, 7)) }} aria-label={`${cell.day} ${monthTitle(cell.key.slice(0, 7))}, ${cell.events.length} compromisso(s)`}><span>{cell.day}</span>{cell.events.length > 0 && <i className="planner-event-dots">{cell.events.slice(0, 3).map((event) => <b key={event.id} className={`event-dot event-${event.type}`} />)}</i>}</button>)}</div><div className="planner-calendar-legend">{[['task', 'Tarefas'], ['plan', 'Planos'], ['goal', 'Metas'], ['workout', 'Treinos'], ['installment', 'Parcelas']].map(([type, label]) => <span key={type}><i className={`event-dot event-${type}`} />{label}</span>)}</div><div className="planner-selected-day"><div className="planner-selected-day-heading"><div><span className="section-kicker">DIA SELECIONADO</span><h3>{dayTitle(selectedDate)}</h3></div><button className="small-primary" type="button" onClick={() => openTaskFor(selectedDate)}><Plus size={13} />Nova tarefa</button></div>{selectedEvents.length ? <div className="planner-event-list">{selectedEvents.map((event) => <article className="planner-event-row" key={event.id}><span className={`planner-event-mark event-${event.type}`} /><div><strong>{event.title}</strong><small>{eventTypeLabel(event.type)}{event.detail ? ` · ${event.detail}` : ''}</small></div></article>)}</div> : <p className="planner-calendar-empty">Sem compromissos anotados neste dia.</p>}</div></section>}

    {tab === 'shopping' && <section className="planner-list-section"><div className="planner-list-intro"><span className="section-kicker">ANOTE SEM PRECISAR COMPRAR AGORA</span><p>Guarde o que deseja comprar, acrescente observações e anexe até {MAX_WISHLIST_ATTACHMENTS} prints comprimidos por item.</p></div>{wishlist.length ? <div className="planner-wish-grid">{wishlist.map((item) => <article className={`planner-wish-card${item.status === 'Comprado' ? ' purchased' : ''}`} key={item.id}><div className="planner-wish-top"><span className={`planner-status-chip${item.status === 'Comprado' ? ' complete' : ''}`}>{item.status}</span><div><button className="icon-button" type="button" aria-label={`Editar ${item.title}`} onClick={() => openShopping(item)}><Pencil size={13} /></button><button className="icon-button danger-hover" type="button" aria-label={`Excluir ${item.title}`} onClick={() => void deleteShoppingItem(item)}><Trash2 size={13} /></button></div></div>{item.attachments.length > 0 && <button className="planner-wish-image" type="button" onClick={() => setPreviewImage(item.attachments[0])} aria-label={`Ver print de ${item.title}`}><img src={item.attachments[0].dataUrl} alt={`Print de referência para ${item.title}`} />{item.attachments.length > 1 && <span>+{item.attachments.length - 1}</span>}</button>}<h2>{item.title}</h2>{item.notes && <p>{item.notes}</p>}<div className="planner-wish-bottom">{item.estimatedPrice !== null && <strong>{currency.format(item.estimatedPrice)}</strong>}<button className="text-button" type="button" onClick={() => void toggleShoppingItem(item)}>{item.status === 'Comprado' ? 'Voltar para desejos' : 'Marcar como comprado'}</button></div>{item.attachments.length > 0 && <div className="planner-wish-thumbs">{item.attachments.map((attachment) => <button type="button" key={attachment.id} onClick={() => setPreviewImage(attachment)} aria-label={`Abrir ${attachment.name}`}><img src={attachment.dataUrl} alt="" /></button>)}</div>}</article>)}</div> : <EmptyCard icon={ShoppingBag} title="Sua lista começa com uma ideia" detail="Salve um item e, se quiser, acrescente um print para lembrar qual era." />}</section>}

    {tab === 'reading' && <section className="planner-list-section"><div className="planner-list-intro"><span className="section-kicker">LEITURA NO SEU RITMO</span><p>Registre livros, avance páginas e deixe uma nota para retomar quando quiser.</p></div>{books.length ? <div className="planner-books-list">{books.map((book) => { const progress = book.totalPages ? Math.min(100, Math.round(book.currentPage / book.totalPages * 100)) : 0; return <article className="planner-book-card" key={book.id}><span className="planner-book-icon"><BookOpen size={19} /></span><div className="planner-book-main"><div className="planner-book-title"><div><h2>{book.title}</h2><p>{book.author || 'Autor não informado'}</p></div><span className={`planner-status-chip${book.status === 'Lido' ? ' complete' : ''}`}>{book.status}</span></div>{book.totalPages > 0 && <><div className="planner-progress-track"><span style={{ width: `${progress}%` }} /></div><small>{book.currentPage} de {book.totalPages} páginas · {progress}%</small></>}{book.notes && <p className="planner-book-note">{book.notes}</p>}</div><div className="planner-card-actions"><button className="icon-button" type="button" aria-label={`Editar ${book.title}`} onClick={() => openBook(book)}><Pencil size={13} /></button><button className="icon-button danger-hover" type="button" aria-label={`Excluir ${book.title}`} onClick={() => { if (window.confirm(`Excluir “${book.title}” da lista de leitura?`)) void removeItem('books', book.id) }}><Trash2 size={13} /></button></div></article> })}</div> : <EmptyCard icon={BookOpen} title="Qual livro está na sua lista?" detail="Adicione um título e acompanhe sua leitura capítulo a capítulo." />}</section>}

    {tab === 'restock' && <section className="planner-list-section"><div className="planner-restock-toolbar"><div><span className="section-kicker">LEMBRETES DE REPOSIÇÃO</span><h2>O que precisa repor?</h2></div><div className="planner-restock-month"><label htmlFor="restock-month">Mês</label><input id="restock-month" type="month" value={restockMonth} onChange={(event) => setRestockMonth(event.target.value)} /></div></div><p className="planner-restock-help">Anote agora os itens que quer lembrar de comprar no mês seguinte.</p>{restockList.length ? <div className="planner-restock-list">{restockList.map((item) => <article className={`planner-restock-row${item.completed ? ' complete' : ''}`} key={item.id}><button className={`planner-task-toggle${item.completed ? ' done' : ''}`} type="button" aria-label={item.completed ? 'Reabrir item' : 'Marcar como resolvido'} onClick={() => void toggleRestock(item)}>{item.completed && <Check size={12} />}</button><div><strong>{item.name}</strong><small>{item.quantity && `${item.quantity} · `}{item.notes || monthTitle(item.neededMonth)}</small></div><button className="icon-button" type="button" aria-label={`Editar ${item.name}`} onClick={() => openRestock(item)}><Pencil size={13} /></button><button className="icon-button danger-hover" type="button" aria-label={`Excluir ${item.name}`} onClick={() => { if (window.confirm(`Excluir “${item.name}” da lista?`)) void removeItem('restockItems', item.id) }}><Trash2 size={13} /></button></article>)}</div> : <EmptyCard icon={Package} title="Lista vazia para este mês" detail="Adicione algo que está acabando para lembrar de repor depois." />}</section>}

    {taskModal && <Modal title="Nova tarefa" onClose={() => setTaskModal(false)}><form className="form-stack" onSubmit={(event) => void submitTask(event)}><label>O que precisa ser feito?<input autoFocus value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="Ex.: Marcar consulta" maxLength={120} /></label><div className="form-two"><label>Prazo<input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} /></label><label>Prioridade<select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value as Task['priority'] })}><option>Baixa</option><option>Normal</option><option>Alta</option></select></label></div><label>Vincular a um plano<select value={taskForm.planId} onChange={(event) => setTaskForm({ ...taskForm, planId: event.target.value })}><option value="">Sem plano</option>{data.plans.filter((plan) => plan.status !== 'Concluído').map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></label><button className="primary-button form-submit" type="submit"><Check size={15} />Salvar tarefa</button></form></Modal>}
    {planModal && <Modal title="Novo plano" onClose={() => setPlanModal(false)}><form className="form-stack" onSubmit={(event) => void submitPlan(event)}><label>Nome do plano<input autoFocus value={planForm.title} onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })} placeholder="Ex.: Organizar a mudança" maxLength={90} /></label><label>O que esse plano significa?<textarea value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} rows={3} maxLength={240} /></label><div className="form-two"><label>Começa em<input type="date" value={planForm.startDate} onChange={(event) => setPlanForm({ ...planForm, startDate: event.target.value })} /></label><label>Prazo final<input type="date" value={planForm.endDate} onChange={(event) => setPlanForm({ ...planForm, endDate: event.target.value })} /></label></div><button className="primary-button form-submit" type="submit"><Check size={15} />Salvar plano</button></form></Modal>}
    {shoppingModal && <Modal title={shoppingEditId ? 'Editar item desejado' : 'Adicionar à lista de desejos'} onClose={() => { setShoppingModal(false); setShoppingEditId(null) }}><form className="form-stack" onSubmit={(event) => void saveShoppingItem(event)}><label>O que você quer comprar?<input autoFocus value={shoppingForm.title} onChange={(event) => setShoppingForm({ ...shoppingForm, title: event.target.value })} placeholder="Ex.: Fone de ouvido" maxLength={100} /></label><label>Preço estimado (opcional)<input inputMode="decimal" value={shoppingForm.estimatedPrice} onChange={(event) => setShoppingForm({ ...shoppingForm, estimatedPrice: event.target.value })} placeholder="0,00" /></label><label>Notas ou detalhes<textarea value={shoppingForm.notes} onChange={(event) => setShoppingForm({ ...shoppingForm, notes: event.target.value })} placeholder="Tamanho, cor, onde encontrar…" rows={3} maxLength={700} /></label><div className="planner-image-uploader"><div><ImagePlus size={17} /><span><strong>Prints de referência</strong><small>{shoppingImages.length}/{MAX_WISHLIST_ATTACHMENTS} · imagens comprimidas automaticamente</small></span></div><label className="ghost-button import-button"><Plus size={13} />Anexar print<input type="file" accept="image/*" multiple disabled={imageBusy || shoppingImages.length >= MAX_WISHLIST_ATTACHMENTS} onChange={(event) => { void addShoppingImages(event.currentTarget.files); event.currentTarget.value = '' }} /></label></div>{imageBusy && <p className="planner-image-hint">Preparando imagem para ocupar menos espaço…</p>}{imageError && <p className="inline-error" role="alert">{imageError}</p>}{shoppingImages.length > 0 && <div className="planner-edit-images">{shoppingImages.map((attachment) => <div key={attachment.id}><img src={attachment.dataUrl} alt={`Anexo ${attachment.name}`} /><button type="button" className="icon-button danger-hover" aria-label="Remover print" onClick={() => setShoppingImages((current) => current.filter((item) => item.id !== attachment.id))}><X size={13} /></button></div>)}</div>}<p className="planner-image-hint">Os prints ficam anexados ao item e sincronizam junto com ele. Para caber no armazenamento Google sem serviço de arquivo separado, são reduzidos e limitados a {MAX_WISHLIST_ATTACHMENTS} por item.</p><button className="primary-button form-submit" type="submit" disabled={imageBusy}><Check size={15} />Salvar item</button></form></Modal>}
    {bookModal && <Modal title={bookEditId ? 'Editar livro' : 'Adicionar livro'} onClose={() => { setBookModal(false); setBookEditId(null) }}><form className="form-stack" onSubmit={(event) => void saveBook(event)}><label>Título<input autoFocus value={bookForm.title} onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })} placeholder="Ex.: Hábitos Atômicos" maxLength={120} /></label><label>Autora/autor (opcional)<input value={bookForm.author} onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })} maxLength={90} /></label><label>Situação<select value={bookForm.status} onChange={(event) => setBookForm({ ...bookForm, status: event.target.value as ReadingBook['status'] })}><option>Quero ler</option><option>Lendo</option><option>Lido</option></select></label><div className="form-two"><label>Página atual<input type="number" min="0" value={bookForm.currentPage} onChange={(event) => setBookForm({ ...bookForm, currentPage: event.target.value })} /></label><label>Total de páginas<input type="number" min="0" value={bookForm.totalPages} onChange={(event) => setBookForm({ ...bookForm, totalPages: event.target.value })} placeholder="Opcional" /></label></div><label>Notas<textarea value={bookForm.notes} onChange={(event) => setBookForm({ ...bookForm, notes: event.target.value })} rows={3} maxLength={700} /></label>{pageError && <p className="inline-error">{pageError}</p>}<button className="primary-button form-submit" type="submit"><Check size={15} />Salvar livro</button></form></Modal>}
    {restockModal && <Modal title={restockEditId ? 'Editar reposição' : 'Adicionar reposição'} onClose={() => { setRestockModal(false); setRestockEditId(null) }}><form className="form-stack" onSubmit={(event) => void saveRestock(event)}><label>O que precisa repor?<input autoFocus value={restockForm.name} onChange={(event) => setRestockForm({ ...restockForm, name: event.target.value })} placeholder="Ex.: Creme dental" maxLength={100} /></label><div className="form-two"><label>Quantidade (opcional)<input value={restockForm.quantity} onChange={(event) => setRestockForm({ ...restockForm, quantity: event.target.value })} placeholder="Ex.: 2 unidades" maxLength={40} /></label><label>Mês para repor<input type="month" value={restockForm.neededMonth} onChange={(event) => setRestockForm({ ...restockForm, neededMonth: event.target.value })} /></label></div><label>Observações<textarea value={restockForm.notes} onChange={(event) => setRestockForm({ ...restockForm, notes: event.target.value })} rows={2} maxLength={300} /></label>{pageError && <p className="inline-error">{pageError}</p>}<button className="primary-button form-submit" type="submit"><Check size={15} />Salvar item</button></form></Modal>}
    {previewImage && <div className="modal-backdrop planner-image-preview" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewImage(null) }}><section className="planner-image-preview-card" role="dialog" aria-modal="true" aria-label="Print de referência"><button className="icon-button" type="button" onClick={() => setPreviewImage(null)} aria-label="Fechar"><X size={19} /></button><img src={previewImage.dataUrl} alt={previewImage.name} /></section></div>}
  </main>
}

function eventTypeLabel(type: CalendarEvent['type']) {
  const labels: Record<CalendarEvent['type'], string> = { task: 'Tarefa', plan: 'Plano', goal: 'Meta', workout: 'Treino', installment: 'Parcela', restock: 'Reposição', note: 'Diário' }
  return labels[type]
}

export default PlannerView
