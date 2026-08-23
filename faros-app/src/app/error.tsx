'use client'

// ============================================================
// Error boundary por segmento (Next.js App Router).
// Captura excepciones que ocurren en cualquier ruta y evita que
// tumben toda la app (como la excepción por fechaVencimiento
// inválida que reventaba el dashboard).
// ============================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // La app no está diseñada para funcionar sin señal (todo vive en
  // Firestore) — cualquier fetch sin capturar en cualquier pantalla
  // termina acá. En vez de perseguir cada punto suelto uno por uno,
  // si la causa es simplemente falta de conexión mostramos un aviso
  // simple en lugar del genérico "algo salió mal", que asusta de más
  // por algo que no es un bug real.
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' && !navigator.onLine,
  )

  useEffect(() => {
    // App Hosting recoge esto en Cloud Logging
    console.error('[app/error]', { message: error.message, digest: error.digest, stack: error.stack })
  }, [error])

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <div
      className="min-h-dvh flex items-center justify-center px-6"
      style={{ background: '#050505', color: '#f5f5f5' }}
    >
      <div className="w-full max-w-md text-center space-y-6">
        <span
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
          style={offline
            ? { background: 'rgba(230,255,0,0.08)', border: '1px solid rgba(230,255,0,0.3)' }
            : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <span
            className="material-symbols-outlined text-[40px]"
            style={{ color: offline ? '#e6ff00' : '#ef4444' }}
          >
            {offline ? 'cloud_off' : 'error'}
          </span>
        </span>
        <div>
          <h2
            className="font-display text-2xl font-black uppercase tracking-tight mb-3"
            style={{ color: '#fff' }}
          >
            {offline ? 'Sin conexión' : 'Algo salió mal'}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,245,245,0.7)' }}>
            {offline
              ? 'Esta pantalla necesita internet para cargar. Conéctate y vuelve a intentar.'
              : 'Encontramos un problema inesperado. Puedes intentar de nuevo o volver al inicio.'}
          </p>
          {!offline && error.digest && (
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
