'use client'

// ============================================================
// FAROS — Alumno Dashboard
// Ported from Stitch "dashboard_alumno_magnet_edition".
// ============================================================

import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { ScrollVideoPanel } from '@/components/shared/ScrollVideoPanel'
import { BrandImageStrip } from '@/components/shared/BrandImageStrip'

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export default function DashboardPage() {
  const { authorized, loading } = useRoleGuard(['alumno'])
  const { user } = useAuth()
  const firstName = user?.displayName?.split(' ')[0] ?? 'Atleta'

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Dashboard">
      <div className="space-y-8">

        {/* Hero status */}
        <Reveal>
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <p className="label-caps text-[var(--color-primary-fixed)] mb-4 tracking-[0.2em]">
                Elite Performance Status
              </p>
              <h2 className="font-display text-display-lg text-white mb-6 leading-none tracking-tighter uppercase">
                Hola,<br />{firstName}
              </h2>
              <div className="flex flex-wrap gap-8">
                <div className="flex flex-col">
                  <span className="label-caps text-[var(--color-on-surface-variant)]/40 mb-1">Tier</span>
                  <span className="font-display text-headline-md font-extrabold text-white uppercase">
                    {user?.tier ?? 'Swim Pro'}
                  </span>
                </div>
                <div className="w-px h-10 bg-white/10 hidden sm:block" />
                <div className="flex flex-col">
                  <span className="label-caps text-[var(--color-on-surface-variant)]/40 mb-1">Estado</span>
                  <span className="flex items-center gap-2 text-[var(--color-success-emerald)] font-display font-extrabold">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-success-emerald)] shadow-[0_0_10px_#10B981]" />
                    Activo
                  </span>
                </div>
                <div className="w-px h-10 bg-white/10 hidden sm:block" />
                <div className="flex flex-col">
                  <span className="label-caps text-[var(--color-on-surface-variant)]/40 mb-1">Rating</span>
                  <span className="font-display text-headline-md font-extrabold text-[var(--color-primary-fixed)]">91.2%</span>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Training plan */}
          <div className="lg:col-span-8 space-y-6">
            <Reveal delay={0.1}>
              <Card padding="lg">
                <div className="flex items-center gap-4 mb-8">
                  <Badge variant="primary">Intensivo B</Badge>
                  <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60">Enfoque recuperación</span>
                </div>
                <h3 className="font-display text-headline-lg text-white mb-10 uppercase tracking-tighter">
                  Clase del Día
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <p className="label-caps text-[var(--color-primary-fixed)] border-b border-[rgba(230,255,0,0.2)] pb-2 inline-block">
                      Protocolo de sesión
                    </p>
                    <ul className="space-y-4">
                      {[
                        'Calentamiento: 400m libre ritmo mixto',
                        'Series: 8 × 50m sprints (90% intensidad)',
                        'Drills: 200m enfoque en patada',
                      ].map((item, i) => (
                        <li key={i} className="flex items-baseline gap-4 group">
                          <span className="text-[12px] font-black text-[rgba(230,255,0,0.5)] group-hover:text-[var(--color-primary-fixed)] transition-colors">
                            0{i + 1}
                          </span>
                          <span className="text-[var(--color-on-surface)]/70 group-hover:text-white transition-colors">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white/5 p-8 border border-white/5 rounded-2xl">
                    <p className="label-caps text-[var(--color-on-surface-variant)] mb-4 text-[10px]">Notas del coach</p>
                    <p className="text-[var(--color-on-surface)]/90 italic leading-relaxed">
                      &ldquo;{firstName}, prioriza el codo alto en la recuperación. Objetivo &lt; 32s en todos los intervalos de 50m.&rdquo;
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t border-white/5">
                  {[
                    { label: 'Ritmo objetivo', value: '1:24', unit: '/100m' },
                    { label: 'Distancia', value: '1,800m', unit: '' },
                    { label: 'Tiempo', value: '55 MIN', unit: '' },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <span className="block label-caps text-[var(--color-on-surface-variant)]/50 mb-2">{stat.label}</span>
                      <span className="block font-display text-headline-md font-extrabold text-[var(--color-primary-fixed)] uppercase tracking-tighter">
                        {stat.value}<span className="text-sm opacity-50">{stat.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
          </div>

          {/* Right column */}
          <div className="lg:col-span-4 space-y-6">
            <Reveal delay={0.2}>
              <Card>
                <div className="flex justify-between items-start mb-6">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Asistencia</h3>
                  <span className="material-symbols-outlined text-[var(--color-success-emerald)] text-[24px]">check_circle</span>
                </div>
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="font-display text-display-lg font-black text-white leading-none">12</span>
                  <span className="label-caps text-[var(--color-on-surface-variant)]/40">/ 20 sesiones</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-[var(--color-primary-fixed)] w-[60%] shadow-[0_0_15px_rgba(230,255,0,0.4)] rounded-full" />
                </div>
                <p className="label-caps text-[11px] text-[var(--color-on-surface-variant)]/60">
                  8 sesiones para completar ciclo
                </p>
              </Card>
            </Reveal>

            <Reveal delay={0.3}>
              <Card>
                <div className="flex justify-between items-center mb-8">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Standings</h3>
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">military_tech</span>
                </div>
                <div className="space-y-3">
                  {[
                    { pos: '01', name: 'M. Anderson', score: '98.4%', you: false },
                    { pos: '04', name: `${firstName} (Tú)`, score: '91.2%', you: true },
                    { pos: '05', name: 'S. López', score: '89.7%', you: false },
                  ].map((r) => (
                    <div
                      key={r.pos}
                      className={`flex items-center gap-4 p-3 rounded-2xl transition-colors ${
                        r.you
                          ? 'bg-[rgba(230,255,0,0.1)] border border-[rgba(230,255,0,0.2)]'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <span className={`font-black text-[12px] w-4 ${r.you ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/20'}`}>
                        {r.pos}
                      </span>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black ${
                        r.you ? 'bg-[var(--color-primary-fixed)] text-black' : 'bg-white/10 border border-white/10 text-white'
                      }`}>
                        {r.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className={`flex-1 label-caps ${r.you ? 'text-white font-black' : 'text-[var(--color-on-surface-variant)]/70'}`}>
                        {r.name}
                      </span>
                      <span className={`font-black ${r.you ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/50'}`}>
                        {r.score}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ── Scroll-driven brand video reveal ── */}
        <Reveal delay={0.1}>
          <ScrollVideoPanel />
        </Reveal>

        {/* ── Brand image parallax strip ── */}
        <Reveal delay={0.15}>
          <div>
            <p className="label-caps text-[var(--color-on-surface-variant)]/50 mb-4">Identidad Faros</p>
            <BrandImageStrip />
          </div>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
