'use client'

// ============================================================
// FAROS — Alumno Dashboard
// Ported from Stitch "dashboard_alumno_magnet_edition".
// ============================================================

import { useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { ScrollVideoPanel } from '@/components/shared/ScrollVideoPanel'
import { BrandImageStrip } from '@/components/shared/BrandImageStrip'

const EASE = [0.22, 1, 0.36, 1] as const

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

// ── Velocity trend (semana a semana, % del objetivo) ──
const VELOCIDAD = [
  { semana: 'S1', pct: 40 }, { semana: 'S2', pct: 55 }, { semana: 'S3', pct: 45 },
  { semana: 'S4', pct: 70 }, { semana: 'S5', pct: 65 }, { semana: 'S6', pct: 91 },
]

const GRUPOS = [
  { dia: 'MAR 18', nombre: 'Endurance Squad', detalle: '06:00 AM • Piscina A' },
  { dia: 'JUE 20', nombre: 'Sprint Técnico', detalle: '05:30 PM • Piscina B' },
]

export default function DashboardPage() {
  const { authorized, loading } = useRoleGuard(['alumno'])
  const { user } = useAuth()
  const firstName = user?.displayName?.split(' ')[0] ?? 'Atleta'
  const [mensaje, setMensaje] = useState('')
  const [transmitido, setTransmitido] = useState(false)

  function enviarFeedback(e: React.FormEvent) {
    e.preventDefault()
    if (!mensaje.trim()) return
    setTransmitido(true)
    setMensaje('')
    setTimeout(() => setTransmitido(false), 3500)
  }

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
                  <span className="label-caps text-[var(--color-on-surface-variant)]/60 mb-1">Tier</span>
                  <span className="font-display text-headline-md font-extrabold text-white uppercase">
                    {user?.tier ?? 'Swim Pro'}
                  </span>
                </div>
                <div className="w-px h-10 bg-white/10 hidden sm:block" />
                <div className="flex flex-col">
                  <span className="label-caps text-[var(--color-on-surface-variant)]/60 mb-1">Estado</span>
                  <span className="flex items-center gap-2 text-[var(--color-success-emerald)] font-display font-extrabold">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-success-emerald)] shadow-[0_0_10px_#10B981]" />
                    Activo
                  </span>
                </div>
                <div className="w-px h-10 bg-white/10 hidden sm:block" />
                <div className="flex flex-col">
                  <span className="label-caps text-[var(--color-on-surface-variant)]/60 mb-1">Rating</span>
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

            {/* Velocity trend */}
            <Reveal delay={0.18}>
              <Card padding="lg">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Tendencia de velocidad</h3>
                  <span className="label-caps text-[10px] text-[var(--color-primary-fixed)]/80">Fase actual · Semana 6</span>
                </div>
                <div className="h-44 flex items-end justify-between gap-3 md:gap-4">
                  {VELOCIDAD.map((v, i) => {
                    const actual = i === VELOCIDAD.length - 1
                    return (
                      <div key={v.semana} className="flex-1 flex flex-col items-center gap-3 h-full justify-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${v.pct}%` }}
                          transition={{ duration: 0.7, delay: 0.05 * i, ease: EASE }}
                          className={`w-full rounded-t-lg ${
                            actual
                              ? 'bg-[var(--color-primary-fixed)] shadow-[0_0_30px_rgba(230,255,0,0.3)]'
                              : 'bg-white/5 hover:bg-[rgba(230,255,0,0.2)] transition-colors duration-200'
                          }`}
                        />
                        <span className={`label-caps text-[9px] ${actual ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/60'}`}>
                          {v.semana}
                        </span>
                      </div>
                    )
                  })}
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
                  <span className="label-caps text-[var(--color-on-surface-variant)]/60">/ 20 sesiones</span>
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
                        {r.name.split(' ').map((p) => p.replace(/[^\p{L}]/gu, '')[0] ?? '').slice(0, 2).join('').toUpperCase()}
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

            <Reveal delay={0.35}>
              <Card>
                <h3 className="label-caps text-[var(--color-on-surface-variant)]/60 mb-6">Grupos próximos</h3>
                <div className="space-y-4">
                  {GRUPOS.map((g) => (
                    <div
                      key={g.nombre}
                      className="p-5 rounded-2xl border border-white/5 bg-white/5 hover:border-[rgba(230,255,0,0.2)] transition-[border-color] duration-300 group/card"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black text-[var(--color-on-surface-variant)]">
                          {g.dia}
                        </span>
                        <button className="label-caps text-[9px] text-[var(--color-danger-crimson)]/70 hover:text-[var(--color-danger-crimson)] transition-colors duration-200">
                          Cancelar
                        </button>
                      </div>
                      <span className="block font-display text-sm font-extrabold text-white uppercase group-hover/card:text-[var(--color-primary-fixed)] transition-colors duration-200">
                        {g.nombre}
                      </span>
                      <span className="block text-[11px] text-[var(--color-on-surface-variant)]/60 label-caps mt-1">
                        {g.detalle}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ── Línea directa con el coach ── */}
        <Reveal delay={0.15}>
          <Card padding="lg" className="!rounded-[2.5rem]">
            <div className="flex flex-col md:flex-row gap-10 items-center">
              <div className="md:flex-1">
                <h3 className="font-display text-3xl font-extrabold text-white mb-3 uppercase tracking-tighter">
                  Línea directa con tu coach
                </h3>
                <p className="text-[var(--color-on-surface-variant)]/60 max-w-md">
                  Canal inmediato para ajustes técnicos o solicitudes de equipamiento.
                </p>
              </div>
              <form onSubmit={enviarFeedback} className="w-full md:w-1/2 flex flex-col sm:flex-row gap-3">
                <input
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="Escribe tu solicitud..."
                  aria-label="Mensaje para tu coach"
                  className="flex-1 bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/30 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors duration-300"
                />
                <Button type="submit" size="md" disabled={transmitido}>
                  {transmitido ? 'Enviado ✓' : 'Enviar'}
                </Button>
              </form>
            </div>
          </Card>
        </Reveal>

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
