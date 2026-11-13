import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Repeat, Trash2, X } from 'lucide-react'
import type { AppRecord, CollectionName, LifeData, RecurringItem } from '../types'
import { defaultCategoryNames } from './categories'
import { cardMethods, paymentFields, paymentMethods, paymentLabel } from './payment'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const incomeSources = ['Salário', 'Renda extra', 'Investimentos', 'Reembolso', 'Outros']

function monthNow() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function parseAmount(value: string) {
  const text = value.trim()
  return Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text)
}

type Props = {
  data: LifeData
  saveItem: (name: CollectionName, item: AppRecord) => Promise<void>
  removeItem: (name: CollectionName, id: string) => Promise<void>
  onClose: () => void
}

export default function RecurringModal({ data, saveItem, removeItem, onClose }: Props) {
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Casa')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState(String(new Date().getDate()))
  const [startMonth, setStartMonth] = useState(monthNow)
  const [payment, setPayment] = useState('')
  const [card, setCard] = useState('')
  const [error, setError] = useState('')
  const categories = [...defaultCategoryNames, ...data.categories.map((item) => item.name).filter((name) => !defaultCategoryNames.includes(name))]
  const options = kind === 'expense' ? categories : incomeSources

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = parseAmount(amount)
    const dayNumber = Number(day)
    if (!description.trim()) { setError('Informe uma descrição.'); return }
    if (!Number.isFinite(value) || value <= 0) { setError('Informe um valor maior que zero.'); return }
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) { setError('O dia do mês deve estar entre 1 e 31.'); return }
    if (!/^\d{4}-\d{2}$/.test(startMonth)) { setError('Escolha o mês de início.'); return }
    const item: RecurringItem = {
      id: newId(), kind, description: description.trim(), category: options.includes(category) ? category : options[0],
      amount: value, dayOfMonth: dayNumber, startMonth, active: true, lastGenerated: '', createdAt: new Date().toISOString(),
      ...(kind === 'expense' ? paymentFields(payment, card) : {}),
    }
    try {
      await saveItem('recurring', item)
      setDescription(''); setAmount(''); setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.') }
  }

  const items = [...data.recurring].sort((a, b) => a.dayOfMonth - b.dayOfMonth)
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-card modal-wide" role="dialog" aria-modal="true" aria-label="Lançamentos recorrentes">
        <div className="modal-heading">
          <div><span className="section-kicker">Automático todo mês</span><h2>Lançamentos recorrentes</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <p className="muted-small">Salário, aluguel, assinaturas… Cada item vira um lançamento no dia escolhido, todo mês, sem você precisar cadastrar de novo.</p>
        {items.length > 0 && <div className="recurring-list">{items.map((item) => (
          <div className={`recurring-row${item.active ? '' : ' recurring-off'}`} key={item.id}>
            <span className="recurring-icon"><Repeat size={15} /></span>
            <span className="recurring-text"><strong>{item.description}</strong><small>{item.kind === 'income' ? 'Recebimento' : 'Despesa'} · {item.category}{paymentLabel(item.payment, item.card) ? ` · ${paymentLabel(item.payment, item.card)}` : ''} · todo dia {item.dayOfMonth} · desde {item.startMonth.split('-').reverse().join('/')}</small></span>
            <strong className="recurring-amount">{currency.format(item.amount)}</strong>
            <button className="ghost-button" type="button" onClick={() => void saveItem('recurring', { ...item, active: !item.active })}>{item.active ? 'Pausar' : 'Reativar'}</button>
            <button className="icon-button danger-hover" type="button" aria-label={`Excluir ${item.description}`} onClick={() => { if (window.confirm(`Excluir a recorrência “${item.description}”? Os lançamentos já criados continuam.`)) void removeItem('recurring', item.id) }}><Trash2 size={14} /></button>
          </div>
        ))}</div>}
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <div className="form-two">
            <label>Tipo<select value={kind} onChange={(event) => { const next = event.target.value as 'expense' | 'income'; setKind(next); setCategory(next === 'expense' ? 'Casa' : 'Salário') }}><option value="expense">Despesa</option><option value="income">Recebimento</option></select></label>
            <label>{kind === 'expense' ? 'Categoria' : 'Origem'}<select value={category} onChange={(event) => setCategory(event.target.value)}>{options.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          </div>
          {kind === 'expense' && <div className="form-two"><label>Forma de pagamento<select value={payment} onChange={(event) => setPayment(event.target.value)}><option value="">Não informar</option>{paymentMethods.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>{cardMethods.includes(payment) ? <label>Cartão<input value={card} onChange={(event) => setCard(event.target.value)} placeholder="Ex.: Nubank" maxLength={40} /></label> : <span />}</div>}
          <label>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Aluguel, Netflix, Salário" maxLength={80} /></label>
          <div className="form-two">
            <label>Valor (R$)<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></label>
            <label>Dia do mês<input type="number" min="1" max="31" value={day} onChange={(event) => setDay(event.target.value)} /></label>
          </div>
          <label>Começa em<input type="month" value={startMonth} onChange={(event) => setStartMonth(event.target.value)} /></label>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="primary-button form-submit" type="submit"><Plus size={15} />Adicionar recorrência</button>
        </form>
      </section>
    </div>
  )
}
