'use client'

// ============================================================
// FAROS — Botón "Crear clases" (admin)
// Dispara POST /api/seed-clases: genera las próximas semanas de
// clases reales según los horarios fijos de Estrellas UTP, Tiburones
// y Tulcán II, asignadas al instructor indicado.
// ============================================================

import { useState } from 'react'

export function BotonSeedClases() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'idle' | 'trabajando' | 'ok' | 'error'>('idle')
  const [mensaje, setMensaje] = useState<string>('')

  async function crear() {
    if (!email.trim()) { setEstado('error'); setMensaje('Escribe el correo del profesor.'); return }
    if (!window.confirm(
      `Va a crear las próximas 4 semanas de clases (Estrellas UTP, Tiburones, Tulcán II) asignadas a "${email}".\n\n¿Continuar?`,
    )) return

    setEstado('trabajando')
    setMensaje('')
    try {
      const { getAuth } = await import('firebase/auth')
      const token = await getAuth().currentUser?.getIdToken()
      if (!token) throw new Error('Debes iniciar sesión')

      const res = await fetch('/api/seed-clases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ instructorEmail: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setEstado('ok')
      setMensaje(`Listo: ${data.creadas} clases creadas.`)
    } catch (e: any) {
      setEstado('error')
      setMensaje(e?.message ?? 'No se pudo crear las clases.')
    }
  }

  return (
    <div className="inline-flex flex-col gap-2 items-start">
      <div className="inline-flex items-center gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo del profesor"
          className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-xs text-white placeholder:text-white/20 focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
        />
        <button
          onClick={crear}
          disabled={estado === 'trabajando'}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/[0.03] text-white text-xs font-semibold hover:bg-white/[0.08] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[16px]">
            {estado === 'trabajando' ? 'hourglass_top' : 'event'}
          </span>
          {estado === 'trabajando' ? 'Creando…' : 'Crear clases'}
        </button>
      </div>
      {mensaje && (
        <p className={`text-[11px] ${estado === 'ok' ? 'text-[var(--color-success-emerald)]' : 'text-[var(--color-danger-crimson)]'}`}>
          {mensaje}
        </p>
      )}
    </div>
  )
}
