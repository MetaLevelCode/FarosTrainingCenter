'use client'

// ============================================================
// FAROS — Mensajes del alumno (estilo Classroom)
// Deriva sus canales reales desde sus clases (Firestore): el muro
// del/los grupo(s) grupales en los que está inscrito, y un chat
// privado por cada profesor distinto con el que tiene clases.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { Card, Spinner } from '@/components/ui'
import { Conversacion } from '@/components/shared/Conversacion'
import { useCanalMensajes } from '@/hooks/useCanalMensajes'
import { getClasesAlumno, getUsuario } from '@/lib/firestore'
import { canalGrupo, canalPrivado, enviarMensaje } from '@/lib/mensajes'
import { displayName } from '@/lib/types'
import type { Clase, Usuario } from '@/lib/types'

interface CanalTab {
  id: string       // canalId
  label: string
  icon: string
  vacio: string
  placeholder: string
}

export function MensajesAlumno({ alumnoId, alumnoNombre }: { alumnoId: string; alumnoNombre: string }) {
  const [cargando, setCargando] = useState(true)
  const [grupos, setGrupos] = useState<{ nombre: string }[]>([])
  const [profesores, setProfesores] = useState<Usuario[]>([])
  const [tab, setTab] = useState<string | null>(null)

  useEffect(() => {
    if (!alumnoId) return
    getClasesAlumno(alumnoId)
      .then(async (clases: Clase[]) => {
        const nombresGrupo = [...new Set(clases.map((c) => c.nombre_clase))].map((nombre) => ({ nombre }))
        const instructorIds = [...new Set(clases.map((c) => c.instructor_id).filter(Boolean))]
        const usuarios = await Promise.all(instructorIds.map((uid) => getUsuario(uid)))
        setGrupos(nombresGrupo)
        setProfesores(usuarios.filter((u): u is Usuario => !!u))
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [alumnoId])

  const tabs: CanalTab[] = useMemo(() => {
    const grupoTabs: CanalTab[] = grupos.map((g) => ({
      id: canalGrupo(g.nombre),
      label: `Muro · ${g.nombre}`,
      icon: 'forum',
      vacio: 'Aún nadie ha comentado en este grupo.',
      placeholder: 'Comenta con tu grupo…',
    }))
    const dmTabs: CanalTab[] = profesores.map((p) => ({
      id: canalPrivado(p.uid, alumnoId),
      label: `Privado · ${p.nombres.split(' ')[0]}`,
      icon: 'chat',
      vacio: `Empieza la conversación con ${displayName(p)}.`,
      placeholder: `Escríbele a ${p.nombres.split(' ')[0]}…`,
    }))
    return [...grupoTabs, ...dmTabs]
  }, [grupos, profesores, alumnoId])

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === tab)) setTab(tabs[0].id)
  }, [tabs, tab])

  const activa = tabs.find((t) => t.id === tab) ?? null
  const { mensajes } = useCanalMensajes(activa?.id ?? null)

  async function enviar(texto: string) {
    if (!activa) return
    await enviarMensaje(activa.id, alumnoId, alumnoNombre, 'alumno', texto)
  }

  return (
    <Card padding="lg" className="!rounded-[2.5rem]">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-display text-2xl font-extrabold text-white uppercase tracking-tighter">
            Mensajes
          </h3>
          <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1">
            {activa ? activa.label : 'Sin conversaciones todavía'}
          </p>
        </div>

        {tabs.length > 0 && (
          <div className="flex flex-wrap gap-1 p-1 rounded-full bg-black/30 border border-white/10">
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
        )}
      </div>

      {cargando ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : !activa ? (
        <p className="text-center text-sm text-[var(--color-on-surface-variant)]/50 py-10">
          Aún no tienes clases asignadas.
        </p>
      ) : (
        <Conversacion
          mensajes={mensajes}
          yoId={alumnoId}
          onEnviar={enviar}
          placeholder={activa.placeholder}
          vacio={activa.vacio}
        />
      )}
    </Card>
  )
}
