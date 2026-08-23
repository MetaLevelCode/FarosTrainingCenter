'use client'

// ============================================================
// FAROS — Botón "Reparar canales de mensajes" (admin, uso puntual)
// Dispara POST /api/mensajes/backfill. Necesario una sola vez tras
// desplegar Fase 5: los alumnos inscritos ANTES de ese deploy no
// quedaron listados como miembros del muro de su grupo. Idempotente.
// ============================================================

import { useState } from 'react'

export function BotonBackfillMensajes() {
  const [estado, setEstado] = useState<'idle' | 'trabajando' | 'ok' | 'error'>('idle')
  const [mensaje, setMensaje] = useState<string>('')

  async function reparar() {
    if (!window.confirm(
      'Va a recorrer todas las clases y agregar a cada alumno/instructor ya inscrito ' +
      'como miembro del muro de mensajes de su grupo.\n\n' +
      'Es seguro correrlo varias veces (solo agrega, no borra).\n\n¿Continuar?',
    )) return

    setEstado('trabajando')
    setMensaje('')
    try {
      const { getAuth } = await import('firebase/auth')
      const token = await getAuth().currentUser?.getIdToken()
      if (!token) throw new Error('Debes iniciar sesión')

      const res = await fetch('/api/mensajes/backfill', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setEstado('ok')
      setMensaje(`Listo: ${data.canalesActualizados} canales actualizados de ${data.clasesRevisadas} clases revisadas.`)
    } catch (e: any) {
      setEstado('error')
      setMensaje(e?.message ?? 'No se pudo reparar los canales.')
    }
  }

  return (
    <div className="inline-flex flex-col gap-2 items-start">
      <button
        onClick={reparar}
        disabled={estado === 'trabajando'}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/[0.03] text-white text-xs font-semibold hover:bg-white/[0.08] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[16px]">
          {estado === 'trabajando' ? 'hourglass_top' : 'forum'}
        </span>
        {estado === 'trabajando' ? 'Reparando…' : 'Reparar canales de mensajes'}
      </button>
      {mensaje && (
        <p className={`text-[11px] ${estado === 'ok' ? 'text-[var(--color-success-emerald)]' : 'text-[var(--color-danger-crimson)]'}`}>
          {mensaje}
        </p>
      )}
    </div>
  )
}
