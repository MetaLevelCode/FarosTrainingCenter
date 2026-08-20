'use client'

// ============================================================
// Error boundary por segmento (Next.js App Router).
// Captura excepciones que ocurren en cualquier ruta y evita que
// tumben toda la app (como la excepción por fechaVencimiento
// inválida que reventaba el dashboard).
// ============================================================

import { useEffect } from 'react'
import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // App Hosting recoge esto en Cloud Logging
    console.error('[app/error]', { message: error.message, digest: error.digest, stack: error.stack })
  }, [error])

  return (
    <div
      className="min-h-dvh flex items-center justify-center px-6"
      style={{ background: '#050505', color: '#f5f5f5' }}
    >
      <div className="w-full max-w-md text-center space-y-6">
        <span
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <span className="material-symbols-outlined text-[40px]" style={{ color: '#ef4444' }}>
            error
          </span>
        </span>
        <div>
          <h2
            className="font-display text-2xl font-black uppercase tracking-tight mb-3"
            style={{ color: '#fff' }}
          >
            Algo salió mal
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,245,245,0.7)' }}>
            Encontramos un problema inesperado. Puedes intentar de nuevo o volver al inicio.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono mt-3 opacity-40">ref: {error.digest}</p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-full text-sm font-semibold transition-colors"
            style={{ background: '#e6ff00', color: '#050505' }}
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-full text-sm font-semibold border transition-colors"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
