import { COLLECTION_NAMES } from './types'
import type { AppRecord, CollectionName, LifeData } from './types'

export type BackupPayload = Partial<Record<CollectionName, AppRecord[]>>

export function backupFileName(date = new Date()) {
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return `minha-vida-backup-${stamp}.json`
}

export function downloadBackup(data: LifeData) {
  const body = JSON.stringify({ app: 'minha-vida', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = backupFileName()
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Lê e valida um arquivo de backup. Lança um erro em português se o arquivo não for válido. */
export function parseBackup(text: string): { payload: BackupPayload; total: number } {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('Este arquivo não é um backup válido (JSON ilegível).') }
  const root = parsed as { app?: unknown; data?: unknown }
  if (!root || typeof root !== 'object' || root.app !== 'minha-vida' || !root.data || typeof root.data !== 'object') {
    throw new Error('Este arquivo não parece ser um backup do Minha Vida.')
  }
  const source = root.data as Record<string, unknown>
  const payload: BackupPayload = {}
  let total = 0
  for (const name of COLLECTION_NAMES) {
    const list = source[name]
    if (list === undefined) continue
    if (!Array.isArray(list)) throw new Error(`Backup inválido: “${name}” não é uma lista.`)
    const valid = list.filter((item): item is AppRecord => Boolean(item) && typeof item === 'object'
      && typeof (item as { id?: unknown }).id === 'string' && (item as { id: string }).id.length > 0)
    payload[name] = valid
    total += valid.length
  }
  if (!total) throw new Error('O backup não contém nenhum registro.')
  return { payload, total }
}
