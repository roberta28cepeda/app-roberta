import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth'
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

export const LOGIN_PENDING_KEY = 'minha-vida-login-pending'

/**
 * Entra com o Google. Usa popup (funciona em quase todos os navegadores, inclusive com domínios diferentes)
 * e só recorre ao redirecionamento se o popup for bloqueado ou o app estiver instalado no iPhone/iPad,
 * onde popups não funcionam em modo de aplicativo.
 */
export async function signInWithGoogle() {
  if (!auth) throw new Error('O login Google ainda não foi configurado.')
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const installedOnIos = (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (!installedOnIos) {
    try {
      await signInWithPopup(auth, provider)
      return
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      if (code !== 'auth/popup-blocked' && code !== 'auth/operation-not-supported-in-this-environment') throw error
    }
  }
  try { localStorage.setItem(LOGIN_PENDING_KEY, String(Date.now())) } catch { /* ignorado */ }
  await signInWithRedirect(auth, provider)
}
