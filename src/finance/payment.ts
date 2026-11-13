export const paymentMethods = ['Crédito', 'Débito', 'Pix', 'Dinheiro', 'Boleto', 'Transferência', 'Outro']
/** Formas de pagamento que pedem o nome do cartão. */
export const cardMethods = ['Crédito', 'Débito']

const LAST_KEY = 'minha-vida-last-payment'

export function paymentLabel(payment?: string, card?: string) {
  return [payment, card].filter(Boolean).join(' · ')
}

export function readLastPayment(): { payment: string; card: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') as { payment?: unknown; card?: unknown }
    return { payment: typeof raw.payment === 'string' ? raw.payment : '', card: typeof raw.card === 'string' ? raw.card : '' }
  } catch { return { payment: '', card: '' } }
}

export function saveLastPayment(payment: string, card: string) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ payment, card })) } catch { /* ignorado */ }
}

/** Campos opcionais prontos para gravar (o Firestore não aceita valores undefined). */
export function paymentFields(payment: string, card: string) {
  const cleanPayment = paymentMethods.includes(payment) ? payment : ''
  const cleanCard = cardMethods.includes(cleanPayment) ? card.trim().slice(0, 40) : ''
  return { ...(cleanPayment ? { payment: cleanPayment } : {}), ...(cleanCard ? { card: cleanCard } : {}) }
}
