'use client'

import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >{children}</motion.div>
  )
}

const HOY = [
  { name: 'Carlos M.', status: 'present' },
  { name: 'María P.', status: 'present' },
  { name: 'Sofía L.', status: 'pending' },
  { name: 'Diego M.', status: 'pending' },
  { name: 'Andrea R.', status: 'absent' },
]

export default function PortalPage() {
  const { authorized, loading } = useRoleGuard(['entrenador', 'admin'])
  const { user } = useAuth()
  const firstName = user?.displayName?.split(' ')[0] ?? 'Coach'

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Portal Entrenador">
      <div className="space-y-8">
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.2em]">Command Center</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Hola,<br />{firstName}
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Reveal delay={0.1}>
            <Card>
              <p className="label-caps text-[var(--color-on-surface-variant)]/60 mb-4">Alumnos activos</p>
              <p className="font-display text-display-lg font-black text-white leading-none">12</p>
            </Card>
          </Reveal>
          <Reveal delay={0.15}>
            <Card>
              <p className="label-caps text-[var(--color-on-surface-variant)]/60 mb-4">Clases este mes</p>
              <p className="font-display text-display-lg font-black text-[var(--color-primary-fixed)] leading-none">24</p>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <Card>
              <p className="label-caps text-[var(--color-on-surface-variant)]/60 mb-4">Asistencia media</p>
              <p className="font-display text-display-lg font-black text-white leading-none">89%</p>
            </Card>
          </Reveal>
        </div>

        <Reveal delay={0.25}>
          <Card padding="lg">
            <div className="flex items-center gap-4 mb-8">
              <Badge variant="primary">Grupal</Badge>
              <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60">Hoy · 07:00 AM</span>
            </div>
            <h3 className="font-display text-headline-lg text-white mb-8 uppercase tracking-tighter">Asistencia de hoy</h3>
            <div className="space-y-3">
              {HOY.map((a) => (
                <div key={a.name} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-[var(--color-on-surface)]">{a.name}</span>
                  {a.status === 'present' && <Badge variant="success">Asistió</Badge>}
                  {a.status === 'absent' && <Badge variant="danger">Faltó</Badge>}
                  {a.status === 'pending' && <Badge variant="default">Pendiente</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
