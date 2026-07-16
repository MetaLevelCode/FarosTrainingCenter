'use client'

import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >{children}</motion.div>
  )
}

const TRANSACCIONES = [
  { name: 'Carlos Méndez', plan: 'Pro', amount: '$499', status: 'pending' },
  { name: 'Sofía López', plan: 'Pro', amount: '$499', status: 'approved' },
  { name: 'Luis Torres', plan: 'Básico', amount: '$299', status: 'pending' },
]

export default function AdminPage() {
  const { authorized, loading } = useRoleGuard(['admin'])

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Admin Console">
      <div className="space-y-8">
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.2em]">Sistema Faros</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Dashboard
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Ingresos mes', value: '$8,240', accent: true },
            { label: 'Egresos mes', value: '$2,100', accent: false },
            { label: 'Atletas', value: '42', accent: false },
            { label: 'Balance', value: '$6,140', accent: true },
          ].map((s, i) => (
            <Reveal key={s.label} delay={0.05 * i}>
              <Card>
                <p className="label-caps text-[var(--color-on-surface-variant)]/60 mb-3">{s.label}</p>
                <p className={`font-display text-headline-lg font-black leading-none ${s.accent ? 'text-[var(--color-primary-fixed)]' : 'text-white'}`}>
                  {s.value}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.25}>
          <Card padding="lg">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-display text-headline-lg text-white uppercase tracking-tighter">Transacciones</h3>
              <Badge variant="default">2 pendientes</Badge>
            </div>
            <div className="space-y-3">
              {TRANSACCIONES.map((t, i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
                  <div className="flex-1">
                    <p className="text-[var(--color-on-surface)] font-semibold">{t.name}</p>
                    <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">Plan {t.plan}</p>
                  </div>
                  <span className="font-display font-black text-white">{t.amount}</span>
                  {t.status === 'approved'
                    ? <Badge variant="success">Aprobado</Badge>
                    : <Button size="sm" variant="primary">Aprobar</Button>}
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
