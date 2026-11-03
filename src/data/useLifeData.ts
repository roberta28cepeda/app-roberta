import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from 'firebase/firestore'
import { database, firebaseConfigured } from '../firebase'
import { COLLECTION_NAMES, emptyLifeData } from '../types'
import type { AppRecord, CollectionName, LifeData } from '../types'

const LOCAL_KEY = 'minha-vida-demo-v1'
const DEMO_OWNER = '__demo__'
export type SyncState = 'idle' | 'loading' | 'demo' | 'saved' | 'saving' | 'error'

type OwnedData = { ownerId: string; value: LifeData }

function readLocalData(): LifeData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return emptyLifeData()
    const saved = JSON.parse(raw) as Partial<LifeData>
    return { ...emptyLifeData(), ...saved }
  } catch {
    return emptyLifeData()
  }
}

export function useLifeData(userId: string | null, demoMode: boolean) {
  const identity = demoMode ? DEMO_OWNER : userId ?? ''
  const activeIdentity = useRef(identity)
  activeIdentity.current = identity
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
    setStatus('saving')
    try {
      await setDoc(doc(database, 'users', userId, name, item.id), {
        ...(item as unknown as DocumentData),
        updatedAt: new Date().toISOString(),
      })
      setStatus('saved')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Falha ao salvar no Google.'
      setError(message)
      setStatus('error')
      throw reason
    }
  }, [demoMode, userId])

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
    setStatus('saving')
    try {
      await deleteDoc(doc(database, 'users', userId, name, id))
      setStatus('saved')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Falha ao excluir no Google.'
      setError(message)
      setStatus('error')
      throw reason
    }
  }, [demoMode, userId])

  const visibleStatus = !demoMode && userId && stored.ownerId !== userId ? 'loading' : status
  return { data, status: visibleStatus, error, saveItem, removeItem }
}
