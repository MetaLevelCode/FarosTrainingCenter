'use client'

// ============================================================
// FAROS — Auth Context
// Wraps Firebase Auth + Firestore role lookup.
// Falls back to MOCK MODE when Firebase keys are absent, so the
// app runs locally before Firebase is configured.
// ============================================================

import {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { FarosUser, UserRole } from '@/lib/types'

// Detect if Firebase is actually configured
const HAS_FIREBASE = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)

// Mock users for local development (no Firebase needed)
const MOCK_USERS: Record<string, FarosUser & { password: string }> = {
  'alumno@faros.com': {
    uid: 'mock-1', email: 'alumno@faros.com', displayName: 'Carlos Méndez',
    role: 'alumno', plan: 'pro', tier: 'Swim Pro', active: true, password: '123456',
  },
  'entrenador@faros.com': {
    uid: 'mock-2', email: 'entrenador@faros.com', displayName: 'Ana Torres',
    role: 'entrenador', active: true, password: '123456',
  },
  'admin@faros.com': {
    uid: 'mock-3', email: 'admin@faros.com', displayName: 'Luis Faros',
    role: 'admin', active: true, password: '123456',
  },
}

interface AuthContextValue {
  user: FarosUser | null
  loading: boolean
  error: string | null
  isMockMode: boolean
  signIn: (email: string, password: string) => Promise<{ ok: boolean; role?: UserRole; error?: string }>
  signUp: (email: string, password: string, displayName: string, role: UserRole) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FarosUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Restore session ──
  useEffect(() => {
    if (!HAS_FIREBASE) {
      // Mock mode: restore from localStorage
      try {
        const saved = localStorage.getItem('faros-mock-user')
        if (saved) setUser(JSON.parse(saved))
      } catch {}
      setLoading(false)
      return
    }

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Look up role from Firestore
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid))
          const data = snap.data()
          setUser({
            uid: fbUser.uid,
            email: fbUser.email ?? '',
            displayName: fbUser.displayName ?? data?.displayName ?? 'Atleta',
            role: (data?.role as UserRole) ?? 'alumno',
            photoURL: fbUser.photoURL ?? undefined,
            plan: data?.plan,
            tier: data?.tier,
            active: data?.active ?? true,
          })
        } catch {
          setUser({
            uid: fbUser.uid,
            email: fbUser.email ?? '',
            displayName: fbUser.displayName ?? 'Atleta',
            role: 'alumno',
          })
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // ── Sign in ──
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    if (!HAS_FIREBASE) {
      const mock = MOCK_USERS[email]
      if (!mock || mock.password !== password) {
        setError('Credenciales incorrectas')
        return { ok: false, error: 'Credenciales incorrectas' }
      }
      const { password: _pw, ...userData } = mock
      setUser(userData)
      try { localStorage.setItem('faros-mock-user', JSON.stringify(userData)) } catch {}
      return { ok: true, role: userData.role }
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      const role = (snap.data()?.role as UserRole) ?? 'alumno'
      return { ok: true, role }
    } catch (e: any) {
      const msg = e?.code === 'auth/invalid-credential'
        ? 'Credenciales incorrectas'
        : 'No se pudo iniciar sesión'
      setError(msg)
      return { ok: false, error: msg }
    }
  }, [])

  // ── Sign up ──
  const signUp = useCallback(async (
    email: string, password: string, displayName: string, role: UserRole,
  ) => {
    setError(null)
    if (!HAS_FIREBASE) {
      // Mock: just succeed
      return { ok: true }
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await fbUpdateProfile(cred.user, { displayName })
      await setDoc(doc(db, 'users', cred.user.uid), {
        displayName, email, role, active: true, createdAt: Date.now(),
      })
      return { ok: true }
    } catch (e: any) {
      const msg = e?.code === 'auth/email-already-in-use'
        ? 'Ese correo ya está registrado'
        : 'No se pudo crear la cuenta'
      setError(msg)
      return { ok: false, error: msg }
    }
  }, [])

  // ── Sign out ──
  const signOut = useCallback(async () => {
    if (!HAS_FIREBASE) {
      setUser(null)
      try { localStorage.removeItem('faros-mock-user') } catch {}
      return
    }
    await fbSignOut(auth)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <AuthContext.Provider value={{
      user, loading, error, isMockMode: !HAS_FIREBASE,
      signIn, signUp, signOut, clearError,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
