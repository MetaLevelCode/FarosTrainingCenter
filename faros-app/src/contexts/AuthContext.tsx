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
import { HAS_FIREBASE, getFirebase } from '@/lib/firebase'
import { ROSTER } from '@/lib/planes'
import type { FarosUser, UserRole } from '@/lib/types'

// Mock users for local development (no Firebase needed)
const MOCK_USERS: Record<string, FarosUser & { password: string }> = {
  'alumno@faros.com': {
    uid: 'mock-1', email: 'alumno@faros.com', displayName: 'Carlos Méndez',
    role: 'alumno', active: true, password: '123456',
    // Mismo plan que figura en ROSTER (lib/planes.ts): Grupal Knowill 2x/sem.
    planActivo: ROSTER[0].plan,
    tipoDocumento: 'CC', documento: '1.088.301.457',
    fechaNacimiento: '14 de marzo de 1998', genero: 'Masculino',
    telefono: '+57 310 842 5567', ciudad: 'Pereira', departamento: 'Risaralda',
    eps: 'Nueva EPS', rh: 'O+',
    contactoEmergencia: { nombre: 'María Méndez', parentesco: 'Madre', telefono: '+57 312 559 0148' },
  },
  'entrenador@faros.com': {
    uid: 'mock-2', email: 'entrenador@faros.com', displayName: 'Ana Torres',
    role: 'entrenador', active: true, password: '123456',
    tipoDocumento: 'CC', documento: '1.093.774.210',
    fechaNacimiento: '02 de septiembre de 1991', genero: 'Femenino',
    telefono: '+57 315 226 7841', ciudad: 'Pereira', departamento: 'Risaralda',
    eps: 'Sura EPS', rh: 'A+',
    contactoEmergencia: { nombre: 'Jorge Torres', parentesco: 'Esposo', telefono: '+57 300 771 3320' },
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

    // Firebase se descarga aquí, no en el bundle inicial.
    let unsub: (() => void) | undefined
    let cancelado = false

    ;(async () => {
      const [{ auth, db }, { onAuthStateChanged }, { doc, getDoc }] = await Promise.all([
        getFirebase(),
        import('firebase/auth'),
        import('firebase/firestore'),
      ])
      if (cancelado) return

      unsub = onAuthStateChanged(auth, async (fbUser) => {
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
            planActivo: data?.planActivo,
            active: data?.active ?? true,
            tipoDocumento: data?.tipoDocumento,
            documento: data?.documento,
            fechaNacimiento: data?.fechaNacimiento,
            genero: data?.genero,
            telefono: data?.telefono,
            ciudad: data?.ciudad,
            departamento: data?.departamento,
            eps: data?.eps,
            rh: data?.rh,
            contactoEmergencia: data?.contactoEmergencia,
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
    })().catch(() => setLoading(false))

    return () => { cancelado = true; unsub?.() }
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
      const [{ auth, db }, { signInWithEmailAndPassword }, { doc, getDoc }] = await Promise.all([
        getFirebase(), import('firebase/auth'), import('firebase/firestore'),
      ])
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
      const [{ auth, db }, fbAuth, { doc, setDoc }] = await Promise.all([
        getFirebase(), import('firebase/auth'), import('firebase/firestore'),
      ])
      const cred = await fbAuth.createUserWithEmailAndPassword(auth, email, password)
      await fbAuth.updateProfile(cred.user, { displayName })
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
    const [{ auth }, { signOut: fbSignOut }] = await Promise.all([
      getFirebase(), import('firebase/auth'),
    ])
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
