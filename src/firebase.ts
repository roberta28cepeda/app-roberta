import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithRedirect } from 'firebase/auth'
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(config).every((value) => typeof value === 'string' && value.length > 0)
const firebaseApp = firebaseConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null
export const auth = firebaseApp ? getAuth(firebaseApp) : null
// Cache local (IndexedDB): permite abrir e lançar dados sem internet; tudo sobe sozinho quando a conexão volta.
function openDatabase(): Firestore | null {
  if (!firebaseApp) return null
  try {
    return initializeFirestore(firebaseApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  } catch {
    // Já inicializado (recarga em desenvolvimento) ou cache indisponível neste navegador.
    return getFirestore(firebaseApp)
  }
}

export const database = openDatabase()

export async function signInWithGoogle() {
  if (!auth) throw new Error('O login Google ainda não foi configurado.')
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  await signInWithRedirect(auth, provider)
}
