import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { database, firebaseConfigured } from '../firebase'
import { COLLECTION_NAMES, emptyLifeData } from '../types'
import type { AppRecord, CollectionName, LifeData } from '../types'

export const LOCAL_KEY = 'minha-vida-demo-v1'
const DEMO_OWNER = '__demo__'
export type SyncState = 'idle' | 'loading' | 'demo' | 'saved' | 'saving' | 'offline' | 'error'

type OwnedData = { ownerId: string; value: LifeData }

export function readLocalData(): LifeData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return emptyLifeData()
    const saved = JSON.parse(raw) as Partial<LifeData>
    return { ...emptyLifeData(), ...saved }
  } catch {
    return emptyLifeData()
  }
}

export function countRecords(data: LifeData) {
  return COLLECTION_NAMES.reduce((sum, name) => sum + (data[name]?.length ?? 0), 0)
}

export function clearLocalData() {
  try { localStorage.removeItem(LOCAL_KEY) } catch { /* ignorado */ }
}

function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return online
}

export function useLifeData(userId: string | null, demoMode: boolean) {
  const identity = demoMode ? DEMO_OWNER : userId ?? ''
  const activeIdentity = useRef(identity)
  activeIdentity.current = identity
  const online = useOnline()
  const [stored, setStored] = useState<OwnedData>(() => ({
    ownerId: identity,
    value: demoMode ? readLocalData() : emptyLifeData(),
  }))
  const [status, setStatus] = useState<SyncState>(demoMode ? 'demo' : 'idle')
  const [error, setError] = useState('')
  const data = stored.ownerId === identity ? stored.value : emptyLifeData()

  useEffect(() => {
    if (demoMode) {
      setStored({ ownerId: DEMO_OWNER, value: readLocalData() })
      setStatus('demo')
      return
    }
    if (!firebaseConfigured || !database || !userId) {
      setStored({ ownerId: '', value: emptyLifeData() })
      setStatus('idle')
      return
    }

    const activeUid = userId
    const firestore = database
    setStatus('loading')
    setError('')
    const ready = new Set<CollectionName>()
    const stops = COLLECTION_NAMES.map((name) => onSnapshot(
      collection(firestore, 'users', activeUid, name),
      (snapshot) => {
        if (activeIdentity.current !== activeUid) return
        const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as AppRecord[]
        setStored((previous) => {
          const current = previous.ownerId === activeUid ? previous.value : emptyLifeData()
          return { ownerId: activeUid, value: { ...current, [name]: records } as LifeData }
        })
        ready.add(name)
        if (ready.size === COLLECTION_NAMES.length) setStatus('saved')
      },
      (reason: Error) => {
        if (activeIdentity.current !== activeUid) return
        setError(reason.message || 'Não foi possível sincronizar os dados.')
        setStatus('error')
      },
    ))

    return () => stops.forEach((stop) => stop())
  }, [demoMode, userId])

  useEffect(() => {
    if (!demoMode) return
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
    } catch {
      setError('O armazenamento deste navegador está cheio ou indisponível.')
    }
  }, [data, demoMode])

  // A gravação vai primeiro para o cache do aparelho (a tela atualiza na hora, mesmo sem internet)
  // e o Firestore envia ao Google assim que houver conexão. Por isso não esperamos a confirmação do servidor.
  const reportFailure = useCallback((reason: unknown, fallback: string) => {
    setError(reason instanceof Error ? reason.message : fallback)
    setStatus('error')
  }, [])

  const saveItem = useCallback(async (name: CollectionName, item: AppRecord) => {
    setError('')
    if (demoMode) {
      setStored((previous) => {
        const current = previous.ownerId === DEMO_OWNER ? previous.value : emptyLifeData()
        const items = current[name] as AppRecord[]
        return {
          ownerId: DEMO_OWNER,
          value: { ...current, [name]: [...items.filter((record) => record.id !== item.id), item] } as LifeData,
        }
      })
      setStatus('demo')
      return
    }
    if (!firebaseConfigured || !database || !userId) {
      throw new Error('Entre com sua conta Google antes de salvar.')
    }
    setDoc(doc(database, 'users', userId, name, item.id), {
      ...(item as unknown as DocumentData),
      updatedAt: new Date().toISOString(),
    }).catch((reason: unknown) => reportFailure(reason, 'Falha ao salvar no Google.'))
  }, [demoMode, userId, reportFailure])

  const removeItem = useCallback(async (name: CollectionName, id: string) => {
    setError('')
    if (demoMode) {
      setStored((previous) => {
        const current = previous.ownerId === DEMO_OWNER ? previous.value : emptyLifeData()
        return {
          ownerId: DEMO_OWNER,
          value: { ...current, [name]: (current[name] as AppRecord[]).filter((record) => record.id !== id) } as LifeData,
        }
      })
      setStatus('demo')
      return
    }
    if (!firebaseConfigured || !database || !userId) {
      throw new Error('Entre com sua conta Google antes de excluir.')
    }
    deleteDoc(doc(database, 'users', userId, name, id))
      .catch((reason: unknown) => reportFailure(reason, 'Falha ao excluir no Google.'))
  }, [demoMode, userId, reportFailure])

  /** Grava muitos registros de uma vez (restauração de backup e envio dos dados locais). */
  const saveMany = useCallback(async (payload: Partial<Record<CollectionName, AppRecord[]>>) => {
    setError('')
    if (demoMode) {
      setStored((previous) => {
        const current = previous.ownerId === DEMO_OWNER ? previous.value : emptyLifeData()
        const next = { ...current } as Record<CollectionName, AppRecord[]>
        for (const name of COLLECTION_NAMES) {
          const incoming = payload[name]
          if (!incoming?.length) continue
          const ids = new Set(incoming.map((item) => item.id))
          next[name] = [...(current[name] as AppRecord[]).filter((item) => !ids.has(item.id)), ...incoming]
        }
        return { ownerId: DEMO_OWNER, value: next as unknown as LifeData }
      })
      return
    }
    if (!firebaseConfigured || !database || !userId) throw new Error('Entre com sua conta Google antes de salvar.')
    const writes: { name: CollectionName; item: AppRecord }[] = []
    for (const name of COLLECTION_NAMES) for (const item of payload[name] ?? []) writes.push({ name, item })
    const firestore = database
    const stamp = new Date().toISOString()
    for (let start = 0; start < writes.length; start += 400) {
      const batch = writeBatch(firestore)
      for (const { name, item } of writes.slice(start, start + 400)) {
        batch.set(doc(firestore, 'users', userId, name, item.id), { ...(item as unknown as DocumentData), updatedAt: stamp })
      }
      batch.commit().catch((reason: unknown) => reportFailure(reason, 'Falha ao enviar os dados ao Google.'))
    }
  }, [demoMode, userId, reportFailure])

  const base = !demoMode && userId && stored.ownerId !== userId ? 'loading' : status
  const visibleStatus: SyncState = !demoMode && !online && base !== 'error' && base !== 'idle' ? 'offline' : base
  return { data, status: visibleStatus, error, saveItem, removeItem, saveMany }
}
