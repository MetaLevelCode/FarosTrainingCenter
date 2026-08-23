'use client'

// ============================================================
// FAROS — Estudiante · Mensajes
// Apartado propio en el menú: antes solo vivía embebido dentro del
// dashboard. Mismo componente (MensajesAlumno), solo que aquí es el
// contenido principal de la página en vez de una sección más.
// ============================================================

import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { MensajesAlumno } from '@/components/dashboard/MensajesAlumno'

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

export default function MensajesPage() {
  const { authorized, loading, user } = useRoleGuard(['estudiante'])

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
          {user && (
            <MensajesAlumno
              alumnoId={user.uid}
              alumnoNombre={user.nombres.split(' ')[0]}
            />
          )}
        </Reveal>
      </div>
    </GuardedShell>
  )
}
