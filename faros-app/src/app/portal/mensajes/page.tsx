'use client'

// ============================================================
// FAROS — Profesor · Mensajes
// Apartado propio en el menú: antes el chat solo vivía anidado
// dentro de cada tarjeta de clase en el calendario del portal.
// Deriva sus canales reales desde las clases del profesor: un muro
// por cada grupo que dicta, y un chat privado por cada alumno
// distinto entre todas sus clases.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Spinner } from '@/components/ui'
import { Conversacion } from '@/components/shared/Conversacion'
import { useCanalMensajes } from '@/hooks/useCanalMensajes'
import { getClasesProfesor, getUsuarios } from '@/lib/firestore'
import { canalGrupo, canalPrivado, enviarMensaje } from '@/lib/mensajes'
import { displayName } from '@/lib/types'
import type { Usuario } from '@/lib/types'

const EASE = [0.22, 1, 0.36, 1] as const

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >{children}</motion.div>
  )
}

interface CanalTab {
  id: string
  label: string
  icon: string
  vacio: string
  placeholder: string
}

export default function MensajesProfesorPage() {
  const { authorized, loading, user } = useRoleGuard(['profesor'])
  const [cargando, setCargando] = useState(true)
  const [gruposNombres, setGruposNombres] = useState<string[]>([])
  const [alumnos, setAlumnos] = useState<Usuario[]>([])
  const [tab, setTab] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([getClasesProfesor(user.uid), getUsuarios('estudiante')])
      .then(([clases, estudiantes]) => {
        setGruposNombres([...new Set(clases.map((c) => c.nombre_clase))])
        const inscritos = new Set(clases.flatMap((c) => c.estudiantes_inscritos ?? []))
        setAlumnos(estudiantes.filter((u) => inscritos.has(u.uid)))
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [user])

  const tabs: CanalTab[] = useMemo(() => {
    const grupoTabs: CanalTab[] = gruposNombres.map((nombre) => ({
      id: canalGrupo(nombre),
      label: `Muro · ${nombre}`,
      icon: 'forum',
      vacio: 'Aún nadie ha comentado en este grupo.',
      placeholder: 'Escribe a todo el grupo…',
    }))
    const dmTabs: CanalTab[] = user ? alumnos.map((a) => ({
      id: canalPrivado(user.uid, a.uid),
      label: `Privado · ${a.nombres.split(' ')[0]}`,
      icon: 'chat',
      vacio: `Empieza la conversación con ${displayName(a)}.`,
      placeholder: `Escríbele a ${a.nombres.split(' ')[0]}…`,
    })) : []
    return [...grupoTabs, ...dmTabs]
  }, [gruposNombres, alumnos, user])

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === tab)) setTab(tabs[0].id)
  }, [tabs, tab])

  const activa = tabs.find((t) => t.id === tab) ?? null
  const { mensajes } = useCanalMensajes(activa?.id ?? null)

  async function enviar(texto: string) {
    if (!activa || !user) return
    await enviarMensaje(activa.id, user.uid, displayName(user), 'entrenador', texto)
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Mensajes">
      <div className="space-y-8">
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Comunidad</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Mensajes
            </h2>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <Card padding="lg" className="!rounded-[2.5rem]">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">
                {activa ? activa.label : 'Sin conversaciones todavía'}
              </p>

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
                yoId={user?.uid ?? ''}
                onEnviar={enviar}
                placeholder={activa.placeholder}
                vacio={activa.vacio}
              />
            )}
          </Card>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
