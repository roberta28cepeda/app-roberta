import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  onAuthStateChanged,
  getRedirectResult,
  signOut as signOutFirebase,
  type User,
} from 'firebase/auth'
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Cloud,
  CloudOff,
  Download,
  Upload,
  Dumbbell,
  Home,
  ListTodo,
  LockKeyhole,
  LogOut,
  Plus,
  Smartphone,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { auth, firebaseConfigured, signInWithGoogle } from './firebase'
import { clearLocalData, countRecords, readLocalData, useLifeData } from './data/useLifeData'
import { downloadBackup, parseBackup } from './backup'
import { generateRecurring } from './finance/recurring'
import FinanceView from './finance/FinanceView'
import { scheduleInstallments } from './finance/installments'
import PlannerView from './planner/PlannerView'
import type {
  AppRecord,
  CollectionName,
  Goal,
  LifeData,
  WorkoutLog,
  WorkoutRoutine,
} from './types'

const navigation: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: 'home', label: 'Visão geral', icon: Home },
  { key: 'expenses', label: 'Gastos', icon: WalletCards },
  { key: 'goals', label: 'Metas', icon: Target },
  { key: 'planner', label: 'Planner', icon: ListTodo },
  { key: 'gym', label: 'Academia', icon: Dumbbell },
]

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
type ViewKey = 'home' | 'expenses' | 'goals' | 'planner' | 'gym'
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value?: string) {
  if (!value) return 'Sem data'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(date).replace('.', '')
}

function currentMonthKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseNumber(value: string) {
  const normalized = value.trim().includes(',')
    ? value.trim().replace(/\./g, '').replace(',', '.')
    : value.trim()
  return Number(normalized)
}

function friendlyError(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Não foi possível concluir. Tente novamente.'
}

function Modal({ title, onClose, children, wide = false }: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={`modal-card${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading">
          <div><span className="section-kicker">Minha Vida</span><h2>{title}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={19} /></button>
        </div>
        {children}
      </section>
    </div>
  )
}

function EmptyState({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={21} /></span><strong>{title}</strong><p>{detail}</p></div>
}

function StatusPill({ status }: { status: string }) {
  const label = status === 'demo' ? 'Só neste aparelho'
    : status === 'loading' ? 'Sincronizando…'
      : status === 'saving' ? 'Salvando…'
        : status === 'offline' ? 'Sem internet · envia depois'
        : status === 'saved' ? 'Google sincronizado'
          : status === 'error' ? 'Falha na sincronização' : 'Aguardando login'
  const Icon = status === 'demo' ? Smartphone : status === 'error' ? CircleHelp : status === 'offline' ? CloudOff : Cloud
  return <span className={`status-pill ${status === 'error' ? 'status-error' : ''}`}><Icon size={13} />{label}</span>
}

export default function App() {
  const [account, setAccount] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!firebaseConfigured)
  const [authError, setAuthError] = useState('')
  const [view, setView] = useState<ViewKey>('home')
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installHelpOpen, setInstallHelpOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [remindersEnabled, setRemindersEnabled] = useState(() => {
    try { return localStorage.getItem('minha-vida-reminders') === 'on' } catch { return false }
  })

  useEffect(() => {
    if (!auth) { setAuthReady(true); return }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAccount(user)
      setAuthReady(true)
    }, (error) => {
      setAuthError(error.message)
      setAuthReady(true)
    })
    void getRedirectResult(auth).catch((error: unknown) => setAuthError(friendlyError(error)))
    return unsubscribe
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const demoMode = !firebaseConfigured
  const { data, status, error: dataError, saveItem, removeItem, saveMany } = useLifeData(account?.uid ?? null, demoMode)
  const [localPending, setLocalPending] = useState(() => (firebaseConfigured ? countRecords(readLocalData()) : 0))
  const restoreInput = useRef<HTMLInputElement>(null)
  const displayName = account?.displayName || account?.email?.split('@')[0] || 'Minha conta'
  const avatarInitial = displayName.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'M'

  async function removePlannerItem(name: CollectionName, id: string) {
    if (name === 'tasks') {
      const task = data.tasks.find((item) => item.id === id)
      if (task && !window.confirm(`Excluir a tarefa “${task.title}”?`)) return
    }
    if (name === 'plans') {
      const plan = data.plans.find((item) => item.id === id)
      if (plan && !window.confirm(`Excluir o plano “${plan.title}”? As tarefas ligadas a ele continuarão na lista.`)) return
    }
    await removeItem(name, id)
  }

  // Lançamentos recorrentes: cria o que já venceu (idempotente, pode rodar em qualquer aparelho).
  useEffect(() => {
    if (status !== 'saved' && status !== 'demo' && status !== 'offline') return
    if (!data.recurring.length) return
    const { expenses, incomes, updated } = generateRecurring(data.recurring, todayKey())
    if (!updated.length) return
    void saveMany({ expenses, incomes, recurring: updated }).catch((reason: unknown) => setNotice(friendlyError(reason)))
  }, [data.recurring, status, saveMany])

  async function sendLocalData() {
    try {
      await saveMany(readLocalData())
      clearLocalData()
      setLocalPending(0)
      setNotice('Dados deste aparelho enviados para a sua conta.')
    } catch (reason) { setNotice(friendlyError(reason)) }
  }

  function discardLocalData() {
    if (!window.confirm('Descartar os dados salvos só neste aparelho? Esta ação não pode ser desfeita.')) return
    clearLocalData()
    setLocalPending(0)
  }

  async function restoreBackup(file?: File) {
    if (!file) return
    try {
      const { payload, total } = parseBackup(await file.text())
      if (!window.confirm(`Restaurar ${total} registro(s) do backup? Registros com o mesmo código serão substituídos; o restante é mantido.`)) return
      await saveMany(payload)
      setNotice(`${total} registro(s) restaurados do backup.`)
    } catch (reason) { setNotice(friendlyError(reason)) }
  }

  useEffect(() => {
    if (!remindersEnabled || !('Notification' in window) || Notification.permission !== 'granted') return
    const dueTasks = data.tasks.filter((task) => task.status === 'Pendente' && task.dueDate && task.dueDate <= todayKey())
    const dueGoals = data.goals.filter((goal) => goal.current < goal.target && goal.dueDate && goal.dueDate <= todayKey())
    const weekday = new Date().getDay()
    const todaysWorkouts = data.workouts.filter((workout) => workout.dayOfWeek === weekday && workout.lastCompletedAt !== todayKey())
    const messages = [
      dueTasks.length ? { key: 'tasks', title: 'Tarefas para cuidar', body: `${dueTasks.length} tarefa(s) vencem hoje ou estão atrasadas.` } : null,
      dueGoals.length ? { key: 'goals', title: 'Uma meta está chegando', body: `${dueGoals.length} meta(s) precisam de atenção.` } : null,
      todaysWorkouts.length ? { key: 'workout', title: 'Seu treino está no plano', body: todaysWorkouts[0]?.name || 'Confira sua rotina de hoje.' } : null,
    ].filter((item): item is { key: string; title: string; body: string } => item !== null)
    if (!messages.length) return

    const dayKey = todayKey()
    void navigator.serviceWorker?.ready.then(async (registration) => {
      for (const item of messages) {
        const key = `minha-vida-notified-${item.key}-${dayKey}`
        if (localStorage.getItem(key) === 'yes') continue
        await registration.showNotification(item.title, { body: item.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' })
        localStorage.setItem(key, 'yes')
      }
    }).catch(() => undefined)
  }, [data, remindersEnabled])

  async function handleLogin() {
    setAuthError('')
    try { await signInWithGoogle() } catch (error) { setAuthError(friendlyError(error)) }
  }

  async function handleSignOut() {
    if (!auth) return
    try { await signOutFirebase(auth) } catch (error) { setNotice(friendlyError(error)) }
  }

  async function handleInstall() {
    if (!installPrompt) { setInstallHelpOpen(true); return }
    await installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') setNotice('Atalho do app adicionado ao dispositivo.')
    setInstallPrompt(null)
  }

  async function handleReminderToggle() {
    if (!('Notification' in window)) {
      setNotice('Este navegador não oferece notificações para o app.')
      return
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission === 'granted') {
      setRemindersEnabled(true)
      localStorage.setItem('minha-vida-reminders', 'on')
      setNotice('Lembretes ativados neste aparelho. Eles aparecem quando você abre o app.')
    } else {
      setRemindersEnabled(false)
      localStorage.removeItem('minha-vida-reminders')
      setNotice('Permissão de notificações não concedida.')
    }
  }

  if (firebaseConfigured && !authReady) {
    return <div className="auth-screen"><div className="auth-card"><span className="brand-mark large-mark"><Activity size={23} /></span><p>Conectando à sua conta…</p></div></div>
  }

  if (firebaseConfigured && !account) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo"><span className="brand-mark large-mark"><Activity size={23} /></span><span>Minha <b>Vida</b></span></div>
          <span className="section-kicker">Seu espaço, do seu jeito</span>
          <h1>Cuide do que<br /><em>importa para você.</em></h1>
          <p className="auth-copy">Entre com sua conta Google para manter gastos, metas, planos e treinos sincronizados nos seus aparelhos.</p>
          <button className="google-button" type="button" onClick={() => void handleLogin()}>
            <span className="google-g">G</span> Continuar com Google
          </button>
          {authError && <p className="inline-error">{authError}</p>}
          <div className="auth-privacy"><LockKeyhole size={15} /><span>Seus dados ficam separados pela sua conta e só você pode acessá-los.</span></div>
        </div>
      </div>
    )
  }

  let page: ReactNode
  if (view === 'home') page = <HomeView data={data} displayName={displayName} onNavigate={setView} onBackup={() => downloadBackup(data)} onRestore={() => restoreInput.current?.click()} />
  else if (view === 'expenses') page = <FinanceView data={data} saveItem={saveItem} removeItem={removeItem} />
  else if (view === 'goals') page = <GoalsView data={data} saveItem={saveItem} removeItem={removeItem} />
  else if (view === 'planner') page = <PlannerView data={data} saveItem={saveItem} removeItem={removePlannerItem} />
  else page = <GymView data={data} saveItem={saveItem} removeItem={removeItem} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-lockup"><span className="brand-mark"><Activity size={17} /></span><span>Minha <b>Vida</b></span></div>
          <div className="sidebar-caption">UM PASSO DE CADA VEZ</div>
          <nav className="primary-nav" aria-label="Navegação principal">
            {navigation.map(({ key, label, icon: Icon }) => (
              <button className={`nav-item${view === key ? ' active' : ''}`} key={key} onClick={() => setView(key)} type="button">
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
                {key === 'planner' && data.tasks.filter((task) => task.status === 'Pendente').length > 0 && <span className="nav-count">{data.tasks.filter((task) => task.status === 'Pendente').length}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-actions">
            <button className="sidebar-action" type="button" onClick={() => void handleInstall()}><Smartphone size={15} />Instalar no aparelho</button>
            <button className="sidebar-action" type="button" onClick={() => void handleReminderToggle()}><Bell size={15} />{remindersEnabled ? 'Lembretes ativos' : 'Ativar lembretes'}</button>
          </div>
          <p className="storage-note"><span className="status-dot" /><span><strong>{demoMode ? 'Modo de demonstração' : 'Dados privados'}</strong><br />{demoMode ? 'Salvos apenas neste navegador' : 'Acesso pela sua conta Google'}</span></p>
          <div className="profile-card">
            <span className="avatar">{avatarInitial}</span>
            <div><strong>{displayName}</strong><span>{demoMode ? 'Prévia local' : 'Conta conectada'}</span></div>
            {account && <button className="icon-button on-dark" type="button" onClick={() => void handleSignOut()} aria-label="Sair"><LogOut size={15} /></button>}
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Activity size={16} /></span><span>Minha <b>Vida</b></span></div>
          <div className="topbar-actions">
            <StatusPill status={status} />
            <button className="icon-button subtle" type="button" onClick={() => void handleInstall()} aria-label="Instalar aplicativo"><ArrowDownToLine size={17} /></button>
            <button className="top-avatar" type="button" title={displayName}>{avatarInitial}</button>
          </div>
        </header>
        {demoMode && <div className="demo-banner"><CircleHelp size={16} /><span><strong>Prévia local:</strong> ainda não está ligada à sua conta Google. O que você inserir fica somente neste navegador.</span></div>}
        {dataError && <div className="error-banner"><CircleHelp size={16} /><span>Falha ao sincronizar: {dataError}</span></div>}
        {localPending > 0 && account && (status === 'saved' || status === 'offline') && <div className="notice-banner"><Upload size={16} /><span>Há {localPending} registro(s) salvos só neste aparelho (de antes do login). Enviar para a sua conta?</span><button className="small-primary" type="button" onClick={() => void sendLocalData()}>Enviar</button><button className="ghost-button" type="button" onClick={discardLocalData}>Descartar</button></div>}
        {notice && <div className="notice-banner"><CheckCircle2 size={16} /><span>{notice}</span><button className="icon-button" type="button" onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
        {page}
      </div>

      <input ref={restoreInput} type="file" accept="application/json,.json" hidden onChange={(event) => { void restoreBackup(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />

      <nav className="mobile-nav" aria-label="Navegação inferior">
        {navigation.map(({ key, label, icon: Icon }) => (
          <button type="button" className={view === key ? 'mobile-nav-item active' : 'mobile-nav-item'} key={key} onClick={() => setView(key)}>
            <Icon size={18} strokeWidth={1.8} /><span>{key === 'planner' ? 'Planner' : label === 'Visão geral' ? 'Início' : label}</span>
          </button>
        ))}
      </nav>

      {installHelpOpen && <Modal title="Instalar Minha Vida" onClose={() => setInstallHelpOpen(false)}>
        <div className="install-steps">
          <p>O ícone abre o app em tela cheia. Faça a instalação uma vez em cada aparelho.</p>
          <div className="install-step"><span>1</span><p><strong>iPhone ou iPad</strong><br />Abra este link no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”. Ative “Abrir como App Web” e toque em Adicionar.</p></div>
          <div className="install-step"><span>2</span><p><strong>Android</strong><br />Abra no Chrome, toque no menu ⋮ e escolha “Instalar app” ou “Adicionar à tela inicial”.</p></div>
          <p className="muted-small">A instalação só fica disponível no link final HTTPS hospedado no Google.</p>
        </div>
      </Modal>}
    </div>
  )
}

function HomeView({ data, displayName, onNavigate, onBackup, onRestore }: { data: LifeData; displayName: string; onNavigate: (view: ViewKey) => void; onBackup: () => void; onRestore: () => void }) {
  const today = todayKey()
  const month = currentMonthKey()
  const scheduled = data.installmentPlans.flatMap(scheduleInstallments).filter((item) => item.date.startsWith(month))
  const paidPlan = scheduled.filter((item) => item.status === 'paid')
  const plannedTotal = scheduled.filter((item) => item.status === 'planned').reduce((sum, item) => sum + item.amount, 0)
  const convertedExpenseIds = new Set(data.installmentPlans.map((plan) => plan.sourceExpenseId).filter((id): id is string => Boolean(id)))
  const monthExpenses = data.expenses.filter((expense) => !convertedExpenseIds.has(expense.id) && expense.date.startsWith(month))
  const monthTotal = monthExpenses.reduce((sum, item) => sum + item.amount, 0) + paidPlan.reduce((sum, item) => sum + item.amount, 0)
  const monthExpenseCount = monthExpenses.length + paidPlan.length
  const monthExpenseDetail = monthExpenseCount
    ? `${monthExpenseCount} lançamento(s)${plannedTotal ? ` · ${currency.format(plannedTotal)} em parcelas previstas` : ''}`
    : plannedTotal ? `${currency.format(plannedTotal)} em parcelas previstas` : 'Nenhum lançamento ainda'
  const openTasks = data.tasks.filter((task) => task.status === 'Pendente')
  const completedGoals = data.goals.filter((goal) => goal.current >= goal.target).length
  const todaysTasks = openTasks.filter((task) => !task.dueDate || task.dueDate <= today).slice(0, 4)
  const todaysWorkouts = data.workouts.filter((workout) => workout.dayOfWeek === new Date().getDay())
  const monthIncome = data.incomes.filter((income) => income.date.startsWith(month)).reduce((sum, item) => sum + item.amount, 0)
  const budget = data.budgets.find((item) => item.month === month)?.amount
  const freeAmount = budget === undefined ? null : budget - monthTotal - plannedTotal
  const horizon = todayKey(new Date(Date.now() + 7 * 86400000))
  const upcoming = [
    ...scheduled.filter((item) => item.status === 'planned' && item.date >= today && item.date <= horizon)
      .map((item) => ({ id: item.id, date: item.date, title: `${item.description} (${item.installmentNumber}/${item.installmentTotal})`, kind: currency.format(item.amount) })),
    ...openTasks.filter((task) => task.dueDate && task.dueDate <= horizon)
      .map((task) => ({ id: task.id, date: task.dueDate, title: task.title, kind: task.dueDate < today ? 'Atrasada' : 'Tarefa' })),
    ...data.goals.filter((goal) => goal.current < goal.target && goal.dueDate && goal.dueDate <= horizon)
      .map((goal) => ({ id: goal.id, date: goal.dueDate, title: goal.title, kind: 'Meta' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
  const headingDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()).toLocaleUpperCase('pt-BR')
  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div><div className="eyebrow"><span className="eyebrow-line" />{headingDate}</div><h1>Olá, <em>{displayName.split(' ')[0]}.</em></h1><p>Um panorama gentil para você cuidar do que importa.</p></div>
        <button className="primary-button" type="button" onClick={() => onNavigate('planner')}><Plus size={16} />Organizar meu dia</button>
      </div>
      <div className="dashboard-grid">
        <MetricCard icon={WalletCards} label="Gastos neste mês" value={currency.format(monthTotal)} detail={monthExpenseDetail} tone="blue" onClick={() => onNavigate('expenses')} />
        <MetricCard icon={ListTodo} label="Tarefas em aberto" value={String(openTasks.length)} detail={openTasks.length === 1 ? 'uma coisa de cada vez' : 'seguindo no seu ritmo'} tone="pink" onClick={() => onNavigate('planner')} />
        <MetricCard icon={Target} label="Metas concluídas" value={`${completedGoals} / ${data.goals.length}`} detail={data.goals.length ? 'cada avanço conta' : 'comece com um objetivo'} tone="lavender" onClick={() => onNavigate('goals')} />
        <MetricCard icon={Dumbbell} label="Rotinas de treino" value={String(data.workouts.length)} detail={todaysWorkouts.length ? `${todaysWorkouts.length} prevista(s) para hoje` : 'movimento no seu tempo'} tone="mint" onClick={() => onNavigate('gym')} />
      </div>
      <div className="home-columns">
        <section className="panel home-panel">
          <div className="panel-heading"><div><span className="section-kicker">Este mês</span><h2>Resumo financeiro</h2></div><button className="text-button" type="button" onClick={() => onNavigate('expenses')}>Abrir gastos <ArrowUpRight size={14} /></button></div>
          <div className="summary-rows">
            <div><span>Recebido</span><strong>{currency.format(monthIncome)}</strong></div>
            <div><span>Gasto</span><strong>{currency.format(monthTotal)}</strong></div>
            <div><span>Saldo</span><strong className={monthIncome - monthTotal < 0 ? 'summary-negative' : ''}>{currency.format(monthIncome - monthTotal)}</strong></div>
            <div><span>{freeAmount === null ? 'Limite do mês' : freeAmount < 0 ? 'Acima do limite' : 'Ainda livre'}</span><strong className={freeAmount !== null && freeAmount < 0 ? 'summary-negative' : ''}>{freeAmount === null ? 'não definido' : currency.format(Math.abs(freeAmount))}</strong></div>
          </div>
        </section>
        <section className="panel home-panel">
          <div className="panel-heading"><div><span className="section-kicker">Próximos 7 dias</span><h2>Vencimentos</h2></div></div>
          {upcoming.length ? <div className="home-task-list">{upcoming.map((item) => <div className="home-task" key={item.id}><span className="home-task-title">{item.title}</span><span className="summary-tag">{item.kind}</span><time>{formatDate(item.date)}</time></div>)}</div> : <EmptyState icon={CheckCircle2} title="Nada vencendo esta semana" detail="Parcelas, tarefas e metas com prazo próximo aparecem aqui." />}
        </section>
      </div>
      <div className="home-columns">
        <section className="panel home-panel">
          <div className="panel-heading"><div><span className="section-kicker">Seu próximo passo</span><h2>Para hoje</h2></div><button className="text-button" type="button" onClick={() => onNavigate('planner')}>Ver tarefas <ArrowUpRight size={14} /></button></div>
          {todaysTasks.length ? <div className="home-task-list">{todaysTasks.map((task) => <div className="home-task" key={task.id}><span className="task-check" /><span className="home-task-title">{task.title}</span><span className={`priority-dot priority-${task.priority.toLowerCase()}`} />{task.dueDate && <time>{formatDate(task.dueDate)}</time>}</div>)}</div> : <EmptyState icon={CheckCircle2} title="Tudo em dia por aqui" detail="Adicione uma tarefa quando quiser organizar o próximo passo." />}
        </section>
        <section className="panel home-panel highlight-panel">
          <div className="highlight-orb"><Sparkles size={20} /></div><span className="section-kicker">Seu ritmo, suas escolhas</span><h2>Pequenos passos<br />também são progresso.</h2><p>Metas, planos, gastos e treino no mesmo lugar — sem pressa para fazer tudo de uma vez.</p><button className="ghost-button" type="button" onClick={() => onNavigate('goals')}>Revisar minhas metas <ArrowUpRight size={14} /></button>
        </section>
      </div>
      <section className="panel home-panel backup-panel">
        <div className="panel-heading"><div><span className="section-kicker">Segurança</span><h2>Seus dados</h2></div></div>
        <p className="muted-small">Baixe uma cópia completa (gastos, metas, planner, livros, treinos…) ou restaure um backup anterior.</p>
        <div className="backup-actions"><button className="ghost-button" type="button" onClick={onBackup}><Download size={15} />Baixar backup</button><button className="ghost-button" type="button" onClick={onRestore}><Upload size={15} />Restaurar backup</button></div>
      </section>
      <div className="section-title-row"><div><span className="section-kicker">Seu espaço pessoal</span><h2>Continue de onde parou</h2></div></div>
      <div className="quick-grid">
        <QuickAction icon={WalletCards} title="Anotar um gasto" detail="Registre e acompanhe" onClick={() => onNavigate('expenses')} />
        <QuickAction icon={Target} title="Acompanhar uma meta" detail="Veja o quanto já avançou" onClick={() => onNavigate('goals')} />
        <QuickAction icon={CalendarDays} title="Meu planner" detail="Diário, calendário e listas" onClick={() => onNavigate('planner')} />
        <QuickAction icon={Dumbbell} title="Ver meu treino" detail="Sua rotina de academia" onClick={() => onNavigate('gym')} />
      </div>
    </main>
  )
}

function MetricCard({ icon: Icon, label, value, detail, tone, onClick }: { icon: LucideIcon; label: string; value: string; detail: string; tone: string; onClick: () => void }) {
  return <button className={`metric-card tone-${tone}`} type="button" onClick={onClick}><span className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon"><Icon size={17} /></span></span><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></button>
}

function QuickAction({ icon: Icon, title, detail, onClick }: { icon: LucideIcon; title: string; detail: string; onClick: () => void }) {
  return <button className="quick-card" type="button" onClick={onClick}><span className="quick-icon"><Icon size={18} /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight size={15} className="quick-arrow" /></button>
}

type DataActions = {
  data: LifeData
  saveItem: (name: CollectionName, item: AppRecord) => Promise<void>
  removeItem: (name: CollectionName, id: string) => Promise<void>
}

function GoalsView({ data, saveItem, removeItem }: DataActions) {
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [progressId, setProgressId] = useState<string | null>(null)
  const [progressDraft, setProgressDraft] = useState('')
  const [form, setForm] = useState({ title: '', description: '', current: '0', target: '', unit: '', dueDate: '' })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = parseNumber(form.target)
    const current = parseNumber(form.current || '0')
    if (!form.title.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0) {
      setFormError('Informe um nome e um objetivo maior que zero.')
      return
    }
    const goal: Goal = { id: createId(), title: form.title.trim(), description: form.description.trim(), current, target, unit: form.unit.trim() || 'unidades', dueDate: form.dueDate, createdAt: new Date().toISOString() }
    try { await saveItem('goals', goal); setFormOpen(false); setForm({ title: '', description: '', current: '0', target: '', unit: '', dueDate: '' }) }
    catch (error) { setFormError(friendlyError(error)) }
  }

  async function updateProgress(goal: Goal) {
    const current = parseNumber(progressDraft)
    if (!Number.isFinite(current) || current < 0) return
    try { await saveItem('goals', { ...goal, current }); setProgressId(null); setProgressDraft('') }
    catch (error) { setFormError(friendlyError(error)) }
  }

  function amountLabel(value: number, unit: string) {
    return unit === 'R$' ? currency.format(value) : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} ${unit}`
  }

  const completed = data.goals.filter((goal) => goal.current >= goal.target).length
  return (
    <main className="page-wrap">
      <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />OBJETIVOS QUE FAZEM SENTIDO PARA VOCÊ</div><h1>Minhas <em>metas.</em></h1><p>Transforme intenção em pequenos passos acompanháveis.</p></div><button className="primary-button" type="button" onClick={() => { setFormError(''); setFormOpen(true) }}><Plus size={16} />Nova meta</button></div>
      <div className="goal-overview"><div><span className="section-kicker">Seu progresso</span><strong>{completed} de {data.goals.length} metas concluídas</strong></div><div className="overview-track"><span style={{ width: `${data.goals.length ? (completed / data.goals.length) * 100 : 0}%` }} /></div><span className="overview-spark"><Sparkles size={18} /></span></div>
      <div className="goals-grid">{data.goals.length ? [...data.goals].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).map((goal) => {
        const percent = Math.min(100, Math.max(0, Math.round((goal.current / goal.target) * 100)))
        const done = goal.current >= goal.target
        return <article className="goal-card" key={goal.id}><div className="goal-card-top"><span className={`goal-symbol${done ? ' goal-done' : ''}`}><Target size={18} /></span><span className={done ? 'state-chip state-complete' : 'state-chip'}>{done ? 'Concluída' : 'Em andamento'}</span><button className="icon-button danger-hover" type="button" onClick={() => void removeItem('goals', goal.id)} aria-label={`Excluir meta ${goal.title}`}><Trash2 size={15} /></button></div><h2>{goal.title}</h2>{goal.description && <p className="goal-description">{goal.description}</p>}<div className="goal-values"><strong>{amountLabel(goal.current, goal.unit)}</strong><span>de {amountLabel(goal.target, goal.unit)}</span></div><div className="goal-track"><span style={{ width: `${percent}%` }} /></div><div className="goal-card-bottom"><span>{percent}% do caminho</span>{goal.dueDate && <span><CalendarDays size={12} />{formatDate(goal.dueDate)}</span>}</div>
          {progressId === goal.id ? <form className="progress-update" onSubmit={(event) => { event.preventDefault(); void updateProgress(goal) }}><input type="text" inputMode="decimal" value={progressDraft} onChange={(event) => setProgressDraft(event.target.value)} placeholder={`Valor atual (${goal.unit})`} aria-label="Progresso atual" /><button className="small-primary" type="submit">Salvar</button><button className="icon-button" type="button" onClick={() => setProgressId(null)} aria-label="Cancelar"><X size={15} /></button></form> : <button className="goal-update-button" type="button" onClick={() => { setProgressId(goal.id); setProgressDraft(String(goal.current).replace('.', ',')) }}><TrendingUp size={14} />Atualizar progresso</button>}</article>
      }) : <div className="panel empty-panel"><EmptyState icon={Target} title="Sua primeira meta começa com uma ideia" detail="Crie um objetivo e acompanhe cada avanço no seu ritmo." /><button className="primary-button" type="button" onClick={() => setFormOpen(true)}><Plus size={15} />Criar primeira meta</button></div>}</div>
      {formOpen && <Modal title="Criar uma meta" onClose={() => setFormOpen(false)}><form className="form-stack" onSubmit={(event) => void submit(event)}><label>O que você quer alcançar? <input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Guardar para uma viagem" maxLength={90} /></label><label>Um pouco mais sobre ela <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Opcional" rows={2} maxLength={200} /></label><div className="form-two"><label>Já avancei <input inputMode="decimal" value={form.current} onChange={(event) => setForm({ ...form, current: event.target.value })} /></label><label>Objetivo final <input inputMode="decimal" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} placeholder="Ex.: 5000" /></label></div><div className="form-two"><label>Unidade <input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="R$, km, livros…" maxLength={20} /></label><label>Prazo (opcional) <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label></div>{formError && <p className="inline-error">{formError}</p>}<button className="primary-button form-submit" type="submit"><Check size={16} />Salvar meta</button></form></Modal>}
    </main>
  )
}

function GymView({ data, saveItem, removeItem }: DataActions) {
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({ name: '', dayOfWeek: String(new Date().getDay()), exercises: '' })
  const todaysLogs = data.workoutLogs.filter((log) => log.date === todayKey())

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const exercises = form.exercises.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [name, sets, reps, load] = line.split(/[;|]/).map((part) => part.trim())
      return { name, sets: Number(sets) || 3, reps: Number(reps) || 10, load: load || '' }
    })
    if (!form.name.trim() || !exercises.length) { setFormError('Informe o nome do treino e ao menos um exercício.'); return }
    const routine: WorkoutRoutine = { id: createId(), name: form.name.trim(), dayOfWeek: Number(form.dayOfWeek), exercises, createdAt: new Date().toISOString(), lastCompletedAt: '' }
    try { await saveItem('workouts', routine); setFormOpen(false); setForm({ name: '', dayOfWeek: String(new Date().getDay()), exercises: '' }); setFormError('') }
    catch (error) { setFormError(friendlyError(error)) }
  }

  async function markCompleted(routine: WorkoutRoutine) {
    const today = todayKey()
    try {
      await saveItem('workouts', { ...routine, lastCompletedAt: today })
      const log: WorkoutLog = { id: createId(), routineId: routine.id, routineName: routine.name, date: today, notes: '' }
      await saveItem('workoutLogs', log)
    } catch (error) { setFormError(friendlyError(error)) }
  }

  const sortedWorkouts = [...data.workouts].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  return (
    <main className="page-wrap">
      <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />MOVIMENTO NO SEU RITMO</div><h1>Minha <em>academia.</em></h1><p>Uma rotina que cabe na vida real — com espaço para evoluir.</p></div><button className="primary-button" type="button" onClick={() => { setFormError(''); setFormOpen(true) }}><Plus size={16} />Nova rotina</button></div>
      <div className="gym-intro"><div className="gym-intro-icon"><Dumbbell size={23} /></div><div><span className="section-kicker">Constância, não perfeição</span><h2>{todaysLogs.length ? 'Você já se movimentou hoje. Muito bem.' : 'Seu próximo treino começa com o primeiro passo.'}</h2><p>Registre a sua rotina e marque cada treino feito. Seu histórico fica guardado junto com o resto da sua vida.</p></div><div className="gym-stat"><strong>{data.workoutLogs.length}</strong><span>treinos feitos</span></div></div>
      <div className="section-title-row gym-section-heading"><div><span className="section-kicker">Seu planejamento</span><h2>Rotinas de treino</h2></div><span className="soft-counter"><Activity size={14} />{data.workouts.length} {data.workouts.length === 1 ? 'rotina' : 'rotinas'}</span></div>
      <div className="workout-grid">{sortedWorkouts.length ? sortedWorkouts.map((routine) => {
        const doneToday = routine.lastCompletedAt === todayKey()
        return <article className="workout-card" key={routine.id}><div className="workout-card-top"><span className="workout-day"><CalendarDays size={14} />{dayNames[routine.dayOfWeek] ?? 'Dia a combinar'}</span><button className="icon-button danger-hover" type="button" onClick={() => void removeItem('workouts', routine.id)} aria-label={`Excluir rotina ${routine.name}`}><Trash2 size={14} /></button></div><h3>{routine.name}</h3><div className="exercise-list">{routine.exercises.map((exercise, index) => <div className="exercise-row" key={`${exercise.name}-${index}`}><span className="exercise-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{exercise.name}</strong><small>{exercise.sets} séries × {exercise.reps} repetições{exercise.load ? ` · ${exercise.load}` : ''}</small></span></div>)}</div><div className="workout-card-bottom"><span>{routine.exercises.length} exercícios</span><button className={doneToday ? 'workout-done-button done' : 'workout-done-button'} type="button" onClick={() => void markCompleted(routine)} disabled={doneToday}>{doneToday ? <><Check size={14} />Feito hoje</> : <><CheckCircle2 size={14} />Concluí hoje</>}</button></div></article>
      }) : <div className="panel empty-panel"><EmptyState icon={Dumbbell} title="Sua rotina começa aqui" detail="Cadastre os exercícios e os dias em que pretende treinar." /><button className="primary-button" type="button" onClick={() => setFormOpen(true)}><Plus size={15} />Criar rotina</button></div>}</div>
      <section className="panel workout-history"><div className="panel-heading"><div><span className="section-kicker">Cada ida conta</span><h2>Treinos recentes</h2></div><span className="history-icon"><Clock3 size={16} /></span></div>{data.workoutLogs.length ? <div className="history-list">{[...data.workoutLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map((log) => <div className="history-row" key={log.id}><span className="history-check"><Check size={14} /></span><strong>{log.routineName}</strong><span>{formatDate(log.date)}</span><button className="icon-button danger-hover" type="button" onClick={() => void removeItem('workoutLogs', log.id)} aria-label={`Excluir registro ${log.routineName}`}><Trash2 size={14} /></button></div>)}</div> : <p className="history-empty">Quando você marcar um treino como concluído, ele aparecerá aqui.</p>}</section>
      {formOpen && <Modal title="Nova rotina de academia" onClose={() => setFormOpen(false)} wide><form className="form-stack" onSubmit={(event) => void submit(event)}><label>Nome da rotina <input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Treino A — superiores" maxLength={80} /></label><label>Dia da semana <select value={form.dayOfWeek} onChange={(event) => setForm({ ...form, dayOfWeek: event.target.value })}>{dayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Exercícios <textarea rows={6} value={form.exercises} onChange={(event) => setForm({ ...form, exercises: event.target.value })} placeholder={'Um exercício por linha: nome; séries; repetições; carga\nAgachamento; 3; 10; 40 kg\nLeg press; 4; 12; 80 kg'} /></label><p className="form-hint">Formato: exercício; séries; repetições; carga (opcional). Se deixar números em branco, usamos 3 × 10.</p>{formError && <p className="inline-error">{formError}</p>}<button className="primary-button form-submit" type="submit"><Check size={16} />Salvar rotina</button></form></Modal>}
    </main>
  )
}
