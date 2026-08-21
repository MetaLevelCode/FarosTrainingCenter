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
import type { FirebaseStorage } from 'firebase/storage'

const HAS_KEY = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
const ES_DEV = process.env.NODE_ENV !== 'production'

export const HAS_FIREBASE = HAS_KEY

/**
 * Modo demo (usuarios de prueba con contraseña fija). SOLO existe en
 * desarrollo: antes bastaba desplegar sin credenciales para que la app
 * cayera aquí sola y publicara un admin abierto con contraseña conocida.
 * En producción nunca se activa.
 */
export const MOCK_MODE = !HAS_KEY && ES_DEV

/**
 * Producción sin credenciales = despliegue mal configurado. No se
 * degrada a demo: se bloquea el acceso y se avisa, que es lo seguro.
 */
export const MAL_CONFIGURADO = !HAS_KEY && !ES_DEV

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let cache: Promise<{ auth: Auth; db: Firestore; storage: FirebaseStorage }> | null = null

/** Inicializa Firebase la primera vez y reutiliza la instancia. */
export function getFirebase() {
  if (!cache) {
    cache = (async () => {
      const [{ initializeApp, getApps, getApp }, { getAuth }, firestoreMod, { getStorage }] =
        await Promise.all([
          import('firebase/app'),
          import('firebase/auth'),
          import('firebase/firestore'),
          import('firebase/storage'),
        ])
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

      // Firestore: FORZAR long polling en lugar de WebChannel. El auto-detect
      // sigue eligiendo WebChannel primero y falla con
      // "Cannot read properties of undefined (reading M_ID)".
      // Con forceLongPolling el SDK usa HTTP polling clásico — un poco más
      // lento (ms), pero estable e inmune al bug del transporte streaming.
      let db
      try {
        db = firestoreMod.initializeFirestore(app, {
          experimentalForceLongPolling: true,
        })
      } catch {
        db = firestoreMod.getFirestore(app)
      }

      return { auth: getAuth(app), db, storage: getStorage(app) }
    })()
  }
  return cache
}
