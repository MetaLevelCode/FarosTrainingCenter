'use client'

// ============================================================
// FAROS — Botón "Sembrar catálogo" (admin)
// Dispara POST /api/seed-catalogo con el ID token del admin actual.
// El endpoint es idempotente: puede correrse las veces que sea
// para actualizar precios/sedes/grupos sin duplicar registros.
// ============================================================

import { useState } from 'react'

export function BotonSeed() {
  const [estado, setEstado] = useState<'idle' | 'trabajando' | 'ok' | 'error'>('idle')
  const [mensaje, setMensaje] = useState<string>('')

  async function sembrar() {
    if (!window.confirm(
      'Va a poblar/actualizar las colecciones sedes/, grupos/ y tarifas/actual con la configuración del código.\n\n' +
      'Es seguro correrlo varias veces (sobrescribe, no duplica).\n\n' +
      '¿Continuar?',
    )) return

    setEstado('trabajando')
    setMensaje('')
    try {
      const { getAuth } = await import('firebase/auth')
      const token = await getAuth().currentUser?.getIdToken()
      if (!token) throw new Error('Debes iniciar sesión')

      const res = await fetch('/api/seed-catalogo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setEstado('ok')
      setMensaje(`Listo: ${data.sedes} sedes, ${data.grupos} grupos y tarifas actualizadas.`)
    } catch (e: any) {
      setEstado('error')
      setMensaje(e?.message ?? 'No se pudo sembrar el catálogo.')
    }
  }

  return (
    <div className="inline-flex flex-col gap-2 items-start">
      <button
        onClick={sembrar}
        disabled={estado === 'trabajando'}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/[0.03] text-white text-xs font-semibold hover:bg-white/[0.08] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[16px]">
          {estado === 'trabajando' ? 'hourglass_top' : 'database'}
        </span>
        {estado === 'trabajando' ? 'Sembrando…' : 'Sembrar catálogo'}
      </button>
      {mensaje && (
        <p className={`text-[11px] ${estado === 'ok' ? 'text-[var(--color-success-emerald)]' : 'text-[var(--color-danger-crimson)]'}`}>
          {mensaje}
        </p>
      )}
    </div>
  )
}
