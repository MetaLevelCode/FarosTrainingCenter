// ============================================================
// FAROS — Firebase (carga diferida)
// Config desde variables de entorno (ver .env.local.example).
//
// El SDK NO se importa de forma estática: aunque el guard en
// tiempo de ejecución evitaba usarlo sin API key, el bundler
// igual metía Auth + Firestore (~180 kB) en TODAS las páginas.
// Ahora se descarga sólo cuando hay credenciales y sólo al
// momento de necesitarlo, así el shell de la app pinta antes.
// ============================================================

import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

export const HAS_FIREBASE = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let cache: Promise<{ auth: Auth; db: Firestore }> | null = null

/** Inicializa Firebase la primera vez y reutiliza la instancia. */
export function getFirebase() {
  if (!cache) {
    cache = (async () => {
      const [{ initializeApp, getApps, getApp }, { getAuth }, { getFirestore }] =
        await Promise.all([
          import('firebase/app'),
          import('firebase/auth'),
          import('firebase/firestore'),
        ])
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
      return { auth: getAuth(app), db: getFirestore(app) }
    })()
  }
  return cache
}
