'use client'

// ============================================================
// FAROS — Auth Context
// Colección Firestore: usuarios/{uid}
// Rol: 'admin' | 'profesor' | 'estudiante'
// Mock mode activo cuando no hay NEXT_PUBLIC_FIREBASE_API_KEY.
// ============================================================

import {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react'
import { MOCK_MODE, MAL_CONFIGURADO, getFirebase } from '@/lib/firebase'
import type { Usuario, UserRole } from '@/lib/types'

// Producción sin credenciales: no hay a quién autenticar. Se corta ahí
// en vez de caer al modo demo (que sería publicar un admin abierto).
const ERROR_CONFIG = 'La app no está configurada. Avísale al administrador.'

// ── Mock users (SOLO desarrollo) ────────────────────────────
//
// SEGURIDAD: el guard usa el literal `process.env.NODE_ENV` y no una
// constante importada, porque el bundler solo sabe plegar la rama
// muerta con el literal. Con una constante externa el objeto entero
// —contraseñas incluidas— terminaba dentro del JavaScript servido.
const MOCK_USERS: Record<string, Usuario & { password: string }> =
  process.env.NODE_ENV !== 'production' ? {
  'estudiante@faros.com': {
    uid: 'mock-1', email: 'estudiante@faros.com',
    nombres: 'Carlos', apellidos: 'Méndez',
    cedula: '1088301457', rol: 'estudiante',
    telefono: '+57 310 842 5567', telefonoEmergencia: '+57 312 559 0148',
    eps: 'Nueva EPS', sede: 'UTP', nivel: 'Tiburones',
    estadisticas: { clasesReservadas: 8, clasesAsistidas: 7, tasaAsistencia: 87 },
    suscripcionActiva: null,
    password: '123456',
  },
  'profesor@faros.com': {
    uid: 'mock-2', email: 'profesor@faros.com',
    nombres: 'Ana', apellidos: 'Torres',
    cedula: '1093774210', rol: 'profesor',
    telefono: '+57 315 226 7841', sede: 'UTP',
    clasesDadas: 42,
    password: '123456',
  },
  'admin@faros.com': {
    uid: 'mock-3', email: 'admin@faros.com',
    nombres: 'Luis', apellidos: 'Faros',
    cedula: '1001234567', rol: 'admin',
    password: '123456',
  },
} : {}

interface AuthContextValue {
  user: Usuario | null
  loading: boolean
  error: string | null
  isMockMode: boolean
  signIn: (email: string, password: string) => Promise<{ ok: boolean; role?: UserRole; error?: string }>
  signUp: (email: string, password: string, nombres: string, apellidos: string, cedula: string, rol: UserRole, extra?: { telefono?: string; telefonoEmergencia?: string; eps?: string; sede?: string; dificultades?: string[] }) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Restore session ─────────────────────────────────────
  useEffect(() => {
    if (MOCK_MODE) {
      try {
        const saved = localStorage.getItem('faros-mock-user')
        if (saved) setUser(JSON.parse(saved))
      } catch {}
      setLoading(false)
      return
    }

    let unsubAuth: (() => void) | undefined
    let cancelado = false

    ;(async () => {
      const [{ auth, db }, { onAuthStateChanged }, { doc, getDoc }] = await Promise.all([
        getFirebase(),
        import('firebase/auth'),
        import('firebase/firestore'),
      ])
      if (cancelado) return

      unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
        if (!fbUser) {
          setUser(null)
          setLoading(false)
          return
        }

        try {
          const snap = await getDoc(doc(db, 'usuarios', fbUser.uid))
          const data = snap.data()
          if (data) {
            setUser({
              uid: fbUser.uid,
              nombres: data.nombres ?? '',
              apellidos: data.apellidos ?? '',
              cedula: data.cedula ?? '',
              email: fbUser.email ?? data.email ?? '',
              rol: (data.rol as UserRole) ?? 'estudiante',
              telefono: data.telefono,
              telefonoEmergencia: data.telefonoEmergencia,
              eps: data.eps,
              foto_perfil: data.foto_perfil,
              sede: data.sede,
              clasesDadas: data.clasesDadas,
              nivel: data.nivel,
              dificultades: data.dificultades,
              fecha_registro: data.fecha_registro,
              estadisticas: data.estadisticas,
              suscripcionActiva: data.suscripcionActiva ?? null,
              activo: data.activo !== false,
            } as Usuario)
          } else {
            setUser({
              uid: fbUser.uid,
              nombres: fbUser.displayName?.split(' ')[0] ?? '',
              apellidos: fbUser.displayName?.split(' ').slice(1).join(' ') ?? '',
              cedula: '',
              email: fbUser.email ?? '',
              rol: 'estudiante',
            })
          }
        } catch {
          setUser({
            uid: fbUser.uid,
            nombres: fbUser.displayName?.split(' ')[0] ?? '',
            apellidos: fbUser.displayName?.split(' ').slice(1).join(' ') ?? '',
            cedula: '',
            email: fbUser.email ?? '',
            rol: 'estudiante',
          })
        }
        setLoading(false)
      })
    })().catch(() => setLoading(false))

    return () => {
      cancelado = true
      unsubAuth?.()
    }
  }, [])

  // ── Sign in ─────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    if (MAL_CONFIGURADO) {
      setError(ERROR_CONFIG)
      return { ok: false, error: ERROR_CONFIG }
    }
    if (MOCK_MODE) {
      const mock = MOCK_USERS[email]
      if (!mock || mock.password !== password) {
        setError('Credenciales incorrectas')
        return { ok: false, error: 'Credenciales incorrectas' }
      }
      const { password: _pw, ...userData } = mock
      setUser(userData)
      try { localStorage.setItem('faros-mock-user', JSON.stringify(userData)) } catch {}
      return { ok: true, role: userData.rol }
    }

    try {
      const [{ auth, db }, { signInWithEmailAndPassword }, { doc, getDoc }] = await Promise.all([
        getFirebase(), import('firebase/auth'), import('firebase/firestore'),
      ])
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const snap = await getDoc(doc(db, 'usuarios', cred.user.uid))
      const rol = (snap.data()?.rol as UserRole) ?? 'estudiante'
      return { ok: true, role: rol }
    } catch (e: any) {
      const msg = e?.code === 'auth/invalid-credential'
        ? 'Credenciales incorrectas'
        : 'No se pudo iniciar sesión'
      setError(msg)
      return { ok: false, error: msg }
    }
  }, [])

  // ── Sign up ─────────────────────────────────────────────
  const signUp = useCallback(async (
    email: string, password: string,
    nombres: string, apellidos: string, cedula: string, rol: UserRole,
    extra?: { telefono?: string; telefonoEmergencia?: string; eps?: string; sede?: string; dificultades?: string[] },
  ) => {
    setError(null)
    if (MAL_CONFIGURADO) {
      setError(ERROR_CONFIG)
      return { ok: false, error: ERROR_CONFIG }
    }
    if (MOCK_MODE) return { ok: true }

    try {
      const [{ auth, db }, fbAuth, { doc, setDoc }] = await Promise.all([
        getFirebase(), import('firebase/auth'), import('firebase/firestore'),
      ])
      const cred = await fbAuth.createUserWithEmailAndPassword(auth, email, password)
      await fbAuth.updateProfile(cred.user, { displayName: `${nombres} ${apellidos}` })
      // Solo escribe campos del whitelist de firestore.rules (allow create)
      const docData: Record<string, unknown> = {
        nombres, apellidos, cedula, email, rol,
        fecha_registro: Date.now(),
      }
      if (extra?.telefono) docData.telefono = extra.telefono
      if (extra?.telefonoEmergencia) docData.telefonoEmergencia = extra.telefonoEmergencia
      if (extra?.eps) docData.eps = extra.eps
      if (extra?.sede) docData.sede = extra.sede
      if (extra?.dificultades?.length) docData.dificultades = extra.dificultades
      await setDoc(doc(db, 'usuarios', cred.user.uid), docData)
      return { ok: true }
    } catch (e: any) {
      const msg = e?.code === 'auth/email-already-in-use'
        ? 'Ese correo ya está registrado'
        : 'No se pudo crear la cuenta'
      setError(msg)
      return { ok: false, error: msg }
    }
  }, [])

  // ── Sign out ─────────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (MOCK_MODE) {
      setUser(null)
      try { localStorage.removeItem('faros-mock-user') } catch {}
      return
    }
    const [{ auth }, { signOut: fbSignOut }] = await Promise.all([
      getFirebase(), import('firebase/auth'),
    ])
    await fbSignOut(auth)
    setUser(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <AuthContext.Provider value={{
      user, loading, error, isMockMode: MOCK_MODE,
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
