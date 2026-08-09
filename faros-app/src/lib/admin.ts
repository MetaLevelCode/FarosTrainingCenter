// ============================================================
// FAROS — Firebase Admin SDK
// Para uso exclusivo de Route Handlers (servidor). Nunca importar
// desde componentes cliente o lib del lado del navegador.
//
// Local: FIREBASE_SERVICE_ACCOUNT_KEY en .env.local (JSON string)
// App Hosting (prod): ADC automático del entorno gestionado
// ============================================================

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

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
    ? initializeApp({ credential: cert(JSON.parse(key)) })
    : initializeApp() // ADC — Firebase App Hosting en producción
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
