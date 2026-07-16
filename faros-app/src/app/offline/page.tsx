// ============================================================
// FAROS — Offline fallback
// Served by the service worker when a navigation fails and the
// page is not in cache. Static, no client JS needed.
// ============================================================

import type { Metadata } from 'next'
import { FarosLogo } from '@/components/ui'

export const metadata: Metadata = { title: 'Sin conexión' }

export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-8 px-6 text-center" style={{ background: '#050505' }}>
      <FarosLogo size={56} />
      <div>
        <p className="label-caps text-[var(--color-primary-fixed)] mb-4 tracking-[0.3em]">Sin conexión</p>
        <h1 className="font-display text-3xl font-black text-white uppercase tracking-tighter mb-3">
          Estás fuera del agua
        </h1>
        <p className="text-[var(--color-on-surface-variant)] text-sm max-w-sm mx-auto leading-relaxed">
          No hay conexión a internet en este momento. Tus datos se sincronizarán
          automáticamente cuando vuelvas a estar en línea.
        </p>
      </div>
      <a
        href="/"
        className="label-caps text-[11px] px-8 py-4 border-2 border-[var(--color-primary-fixed)] text-[var(--color-primary-fixed)] rounded-2xl hover:bg-[rgba(230,255,0,0.08)] transition-colors duration-300"
      >
        Reintentar
      </a>
    </div>
  )
}
