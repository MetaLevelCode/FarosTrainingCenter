'use client'

// ============================================================
// Global error boundary (Next.js App Router).
// Se usa cuando el error ocurre en el propio RootLayout — hay que
// re-declarar <html> y <body> porque el root ya no está montado.
// ============================================================

import { useEffect, useState } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Igual que en error.tsx: la app depende de Firestore para casi todo,
  // así que sin señal cualquier fetch sin capturar termina acá. Sin
  // señal, un mensaje simple en vez de "error crítico" (que asusta de
  // más por algo que no es un bug real). Sin dependencias externas
  // (ni el font de íconos) porque este es el último recurso.
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' && !navigator.onLine,
  )

  useEffect(() => {
    console.error('[global-error]', { message: error.message, digest: error.digest, stack: error.stack })
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
    <html lang="es">
      <body style={{ backgroundColor: '#050505', color: '#f5f5f5', margin: 0, fontFamily: 'system-ui' }}>
        <div style={{
          minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12, textTransform: 'uppercase' }}>
              {offline ? 'Sin conexión' : 'Error crítico'}
            </h1>
            <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 24 }}>
              {offline
                ? 'Esta pantalla necesita internet para cargar. Conéctate y vuelve a intentar.'
                : 'La aplicación no pudo continuar. Recarga la página para intentarlo de nuevo.'}
            </p>
            <button
              onClick={reset}
              style={{
                padding: '10px 20px', borderRadius: 999, background: '#e6ff00', color: '#050505',
                fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14,
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
