'use client'

// ============================================================
// FAROS — Portal Entrenador
// Todo el portal gira alrededor de un CALENDARIO: cada día muestra
// las clases asignadas; al abrir una clase el coach ve/sube el plan
// de clase (que ve el alumno) y registra la asistencia del día.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { getClasesProfesor } from '@/lib/firestore'
import type { Clase } from '@/lib/types'
import { CalendarioEntrenador } from '@/components/portal/CalendarioEntrenador'

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

export default function PortalPage() {
  const { authorized, loading } = useRoleGuard(['profesor', 'admin'])
  const { user } = useAuth()
  const firstName = user?.nombres ?? 'Coach'
  const [clases, setClases] = useState<Clase[]>([])

  useEffect(() => {
    if (!user?.uid) return
    getClasesProfesor(user.uid).then(setClases).catch(console.error)
  }, [user?.uid])

  const { sesionesMes, horasTotales } = useMemo(() => {
    const hoy = new Date()
    const enEsteMes = clases.filter((c) => {
      const d = new Date(c.fecha_hora_inicio)
      return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth()
    })
    const horas = clases.reduce((s, c) => s + (c.fecha_hora_fin - c.fecha_hora_inicio) / 3_600_000, 0)
    return { sesionesMes: enEsteMes.length, horasTotales: Math.round(horas) }
  }, [clases])

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Portal Entrenador">
      <div className="space-y-8">

        {/* ── Header + stats ── */}
        <Reveal>
          <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="h-px w-8 bg-[var(--color-primary-fixed)]" />
                <span className="label-caps text-[var(--color-primary-fixed)] tracking-[0.3em]">Portal de Entrenador</span>
              </div>
              <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase mb-4">
                Hola,<br />Coach {firstName}
              </h2>
              <p className="text-[var(--color-on-surface-variant)]/80 max-w-xl border-l border-white/20 pl-6">
                Tu calendario de clases. Abre un día para subir el plan de la sesión
                y registrar la asistencia de tus atletas.
              </p>
            </div>
            <Card className="shrink-0">
              <div className="flex items-center gap-8 px-2">
                <div className="text-center">
                  <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mb-1">Sesiones mes</p>
                  <p className="font-display text-3xl font-black text-[var(--color-primary-fixed)]">{sesionesMes}</p>
                </div>
                <span className="h-12 w-px bg-white/10" />
                <div className="text-center">
                  <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mb-1">Horas totales</p>
                  <p className="font-display text-3xl font-black text-[var(--color-primary-fixed)]">{horasTotales}</p>
                </div>
              </div>
            </Card>
          </section>
        </Reveal>

        {/* ── Calendario (plan de clase + asistencia por día) ── */}
        <Reveal delay={0.1}>
          <CalendarioEntrenador />
        </Reveal>
      </div>
    </GuardedShell>
  )
}
