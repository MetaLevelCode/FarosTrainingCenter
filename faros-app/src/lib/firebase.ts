// ============================================================
// FAROS — Firebase Initialization
// Config comes from environment variables (see .env.local.example)
// ============================================================

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Only initialize when a real API key is present.
// In mock mode (no key), export null — AuthContext never touches these.
const HAS_KEY = Boolean(firebaseConfig.apiKey)

const app = HAS_KEY
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

export const auth = app ? getAuth(app) : (null as any)
export const db = app ? getFirestore(app) : (null as any)
export default app
