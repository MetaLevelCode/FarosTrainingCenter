'use client'

// ============================================================
// FAROS — Profesor · Plan Virtual
// Lista de alumnos con rutina virtual asignada a este profesor.
// El CRUD de sesiones vive en RutinaVirtualCard (compartido con la
// pestaña Virtual de /admin/planes).
// ============================================================

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Spinner } from '@/components/ui'
import { RutinaVirtualCard } from '@/components/shared/RutinaVirtualCard'
import { getRutinasProfesor } from '@/lib/firestore'
import type { RutinaVirtual } from '@/lib/types'

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

export default function PortalVirtualPage() {
  const { authorized, loading, user } = useRoleGuard(['profesor'])
  const [cargando, setCargando] = useState(true)
  const [rutinas, setRutinas] = useState<RutinaVirtual[]>([])

  useEffect(() => {
    if (!user?.uid) return
    getRutinasProfesor(user.uid)
      .then(setRutinas)
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [user?.uid])

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Plan Virtual">
      <div className="space-y-8">
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Rutinas remotas</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Plan Virtual
            </h2>
          </div>
        </Reveal>

        {cargando ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : rutinas.length === 0 ? (
          <Reveal delay={0.1}>
            <Card>
              <p className="text-center text-sm text-[var(--color-on-surface-variant)]/60 py-10">
                No tienes alumnos con Plan Virtual asignado todavía.
              </p>
            </Card>
          </Reveal>
        ) : (
          <div className="space-y-4">
            {rutinas.map((r, i) => (
              <Reveal key={r.id} delay={0.05 * i}>
                <RutinaVirtualCard rutina={r} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </GuardedShell>
  )
}
