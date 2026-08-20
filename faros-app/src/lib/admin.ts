// ============================================================
// FAROS — Firebase Admin SDK
// Para uso exclusivo de Route Handlers (servidor). Nunca importar
// desde componentes cliente o lib del lado del navegador.
//
// Local: FIREBASE_SERVICE_ACCOUNT_KEY en .env.local (JSON string)
// App Hosting (prod): ADC automático del entorno gestionado
// ============================================================

import { getApps, initializeApp, cert, applicationDefault, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  ?? 'faros-training-center.firebasestorage.app'

let app: App

function initAdmin(): App {
  if (app) return app
  const existing = getApps()
  if (existing.length > 0) {
    app = existing[0]
    return app
  }

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  app = key
    ? initializeApp({ credential: cert(JSON.parse(key)), storageBucket: STORAGE_BUCKET })
    : initializeApp({ credential: applicationDefault(), storageBucket: STORAGE_BUCKET })
  return app
}

export function getAdminDb() {
  initAdmin()
  return getFirestore()
}

export function getAdminAuth() {
  initAdmin()
  return getAuth()
}

export function getAdminStorage() {
  return getStorage(initAdmin())
}

/**
 * Extrae el path del objeto en Storage a partir de una URL de descarga
 * de Firebase Storage (…/o/<path-encoded>?alt=media&token=…).
 * Devuelve null si no reconoce la URL.
 */
export function pathFromDownloadUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'firebasestorage.googleapis.com') return null
    const m = u.pathname.match(/\/o\/([^?]+)/)
    return m ? decodeURIComponent(m[1]) : null
  } catch {
    return null
  }
}
