'use client'

// ============================================================
// FAROS — Mensajes del alumno (estilo Classroom)
// Dos pestañas: el muro de su clase (todos comentan) y el chat
// privado con su profesor.
// ============================================================

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui'
import { Conversacion } from '@/components/shared/Conversacion'
import {
  mensajesSemilla, delCanal, nuevoMensaje, canalGrupo, canalPrivado,
  COACH_ID, COACH_NOMBRE, type Mensaje,
} from '@/lib/mensajes'

type Tab = 'muro' | 'privado'

export function MensajesAlumno({
  alumnoId, alumnoNombre, claseId, claseNombre,
}: {
  alumnoId: string
  alumnoNombre: string
  claseId: string
  claseNombre: string
}) {
  const [tab, setTab] = useState<Tab>('muro')
  const [mensajes, setMensajes] = useState<Mensaje[]>(() => mensajesSemilla())

  const canalId = tab === 'muro' ? canalGrupo(claseId) : canalPrivado(alumnoId, COACH_ID)
  const hilo = useMemo(() => delCanal(mensajes, canalId), [mensajes, canalId])

  function enviar(texto: string) {
    setMensajes((prev) => [...prev, nuevoMensaje(canalId, alumnoId, alumnoNombre, 'alumno', texto)])
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'muro', label: 'Muro de la clase', icon: 'forum' },
    { id: 'privado', label: `Privado con ${COACH_NOMBRE.split(' ')[0]}`, icon: 'chat' },
  ]

  return (
    <Card padding="lg" className="!rounded-[2.5rem]">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-display text-2xl font-extrabold text-white uppercase tracking-tighter">
            Mensajes
          </h3>
          <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1">
            {tab === 'muro' ? claseNombre : `Conversación privada con ${COACH_NOMBRE}`}
          </p>
        </div>

        <div className="flex gap-1 p-1 rounded-full bg-black/30 border border-white/10">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-full label-caps text-[9px] transition-colors duration-200 ${
                tab === t.id
                  ? 'bg-[var(--color-primary-fixed)] text-black'
                  : 'text-[var(--color-on-surface-variant)]/60 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Conversacion
        mensajes={hilo}
        yoId={alumnoId}
        onEnviar={enviar}
        placeholder={tab === 'muro' ? 'Comenta con tu clase…' : `Escríbele a ${COACH_NOMBRE.split(' ')[0]}…`}
        vacio={tab === 'muro' ? 'Aún nadie ha comentado en esta clase.' : 'Empieza la conversación con tu profesor.'}
      />
    </Card>
  )
}
