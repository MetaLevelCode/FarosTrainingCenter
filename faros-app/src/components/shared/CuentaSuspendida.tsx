'use client'

// ============================================================
// FAROS — Banner + pantalla de "cuenta suspendida"
// Se activa cuando user.activo === false. Reemplaza la UI de la
// ruta actual para que el estudiante entienda por qué las acciones
// están fallando (Firestore rules bloquean todo cuando activo=false).
// ============================================================

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { FarosWordmark } from '@/components/ui'

export function CuentaSuspendida({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()

  if (!user || user.activo !== false) {
    return <>{children}</>
  }

  return (
    <div
      className="relative min-h-dvh flex flex-col"
      style={{ background: '#050505', color: '#f5f5f5' }}
    >
      <header className="relative z-10 h-20 px-5 md:px-10 flex items-center justify-between shrink-0">
        <FarosWordmark size="sm" />
        <button
          onClick={() => { void signOut() }}
          className="text-xs text-white/60 hover:text-white transition-colors"
        >
          Cerrar sesión
        </button>
      </header>
      <main className="relative z-10 flex-1 flex items-center justify-center px-5 md:px-10 pb-10">
        <div className="w-full max-w-md text-center">
          <span
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-7"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <span className="material-symbols-outlined text-[40px]" style={{ color: '#ef4444' }}>
              lock
            </span>
          </span>
          <h2 className="font-display text-2xl font-black text-white uppercase tracking-tight mb-4">
            Cuenta suspendida
          </h2>
          <p className="text-sm text-[var(--color-on-surface-variant)]/70 leading-relaxed mb-8">
            Tu cuenta está inactiva y no puede realizar acciones. Comunícate con la
            administración de Faros para reactivarla.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-full border border-white/15 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  )
}
