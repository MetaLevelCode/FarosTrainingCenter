'use client'

// ============================================================
// FAROS — Alumno · Ranking
// Requisitos (notas ② Usuarios):
//  - Tabla en el ranking (con tu posición destacada)
//  - % de ritmos de nado según chequeos de velocidad por distancia
// ============================================================

import { useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'

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

// ── Datos de ejemplo (se reemplazan por Firestore) ──
const RANKING = [
  { pos: 1, nombre: 'M. Anderson', rating: 98.4, asistencias: 19, tú: false },
  { pos: 2, nombre: 'L. Fernández', rating: 95.1, asistencias: 18, tú: false },
  { pos: 3, nombre: 'V. Castro', rating: 93.7, asistencias: 18, tú: false },
  { pos: 4, nombre: 'Carlos Méndez', rating: 91.2, asistencias: 12, tú: true },
  { pos: 5, nombre: 'S. López', rating: 89.7, asistencias: 15, tú: false },
  { pos: 6, nombre: 'D. Morales', rating: 87.3, asistencias: 14, tú: false },
  { pos: 7, nombre: 'A. Rojas', rating: 84.9, asistencias: 11, tú: false },
]

// Chequeos de velocidad: % del objetivo por distancia
const RITMOS = [
  { distancia: '50 m', mejor: '0:30.9', objetivo: '0:29.0', pct: 88 },
  { distancia: '100 m', mejor: '1:08.4', objetivo: '1:04.0', pct: 82 },
  { distancia: '200 m', mejor: '2:31.2', objetivo: '2:22.0', pct: 76 },
  { distancia: '400 m', mejor: '5:24.8', objetivo: '5:02.0', pct: 71 },
]

const PODIO_STYLE: Record<number, { ring: string; medal: string }> = {
  1: { ring: 'border-[var(--color-primary-fixed)]', medal: 'text-[var(--color-primary-fixed)]' },
  2: { ring: 'border-white/40', medal: 'text-white/70' },
  3: { ring: 'border-[#c47a3d]/60', medal: 'text-[#c47a3d]' },
}

function ini(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function RankingPage() {
  const { authorized, loading } = useRoleGuard(['alumno'])
  const { user } = useAuth()
  const miNombre = user?.displayName ?? 'Carlos Méndez'
  const [rango, setRango] = useState<'general' | 'mensual'>('general')

  const podio = RANKING.slice(0, 3)
  const yo = RANKING.find((r) => r.tú)

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Ranking">
      <div className="space-y-8">

        {/* ── Header ── */}
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Standings de élite</p>
              <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
                Ranking
              </h2>
            </div>
            <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl" role="group" aria-label="Rango del ranking">
              {(['general', 'mensual'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRango(r)}
                  aria-pressed={rango === r}
                  className={`px-5 py-2 text-[10px] font-black rounded-lg uppercase tracking-widest transition-colors duration-200 ${
                    rango === r
                      ? 'bg-[var(--color-primary-fixed)] text-black shadow-[0_0_15px_rgba(230,255,0,0.2)]'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {r === 'general' ? 'General' : 'Mensual'}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── Podio ── */}
        <div className="grid grid-cols-3 gap-3 md:gap-6">
          {[podio[1], podio[0], podio[2]].map((p, idx) => {
            const destacado = p.pos === 1
            const st = PODIO_STYLE[p.pos]
            return (
              <Reveal key={p.pos} delay={0.05 * idx}>
                <Card className={`text-center ${destacado ? '!border-[rgba(230,255,0,0.4)] md:-translate-y-3' : ''}`}>
                  <div className="flex flex-col items-center">
                    <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full border-2 ${st.ring} flex items-center justify-center mb-4`}>
                      <span className="font-display text-lg md:text-xl font-black text-white">{ini(p.nombre)}</span>
                      <span className={`absolute -bottom-2 material-symbols-outlined text-[22px] ${st.medal} bg-[#0a0a0a] rounded-full`}>
                        {destacado ? 'emoji_events' : 'military_tech'}
                      </span>
                    </div>
                    <span className={`font-display font-black leading-none mb-1 ${destacado ? 'text-2xl md:text-3xl text-[var(--color-primary-fixed)]' : 'text-xl text-white'}`}>
                      #{p.pos}
                    </span>
                    <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/70 truncate max-w-full">{p.nombre}</span>
                    <span className="font-display text-sm font-black text-white mt-2">{p.rating}%</span>
                  </div>
                </Card>
              </Reveal>
            )
          })}
        </div>

        {/* ── Tu posición (banner destacado) ── */}
        {yo && (
          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-[rgba(230,255,0,0.3)] bg-[rgba(230,255,0,0.06)] p-5 flex items-center gap-4">
              <span className="font-display text-2xl font-black text-[var(--color-primary-fixed)] w-10 text-center shrink-0">
                #{yo.pos}
              </span>
              <span className="w-11 h-11 rounded-full bg-[var(--color-primary-fixed)] text-black flex items-center justify-center font-black text-sm shrink-0">
                {ini(miNombre)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-black text-white uppercase tracking-tight truncate">{miNombre} (Tú)</p>
                <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mt-0.5">{yo.asistencias} asistencias este ciclo</p>
              </div>
              <span className="font-display text-xl font-black text-[var(--color-primary-fixed)] shrink-0">{yo.rating}%</span>
            </div>
          </Reveal>
        )}

        {/* ── Tabla completa ── */}
        <Reveal delay={0.14}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/10 bg-white/[0.02]">
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Tabla completa
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[520px]">
                <thead className="bg-white/5">
                  <tr>
                    {['#', 'Atleta', 'Asistencias', 'Rating'].map((h) => (
                      <th key={h} className="px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {RANKING.map((r) => (
                    <tr
                      key={r.pos}
                      className={r.tú ? 'bg-[rgba(230,255,0,0.06)]' : 'hover:bg-white/[0.03] transition-colors duration-200'}
                    >
                      <td className={`px-6 py-4 font-display font-black ${r.tú ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/40'}`}>
                        {r.pos}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                            r.tú ? 'bg-[var(--color-primary-fixed)] text-black' : 'bg-white/10 text-white border border-white/10'
                          }`}>
                            {ini(r.nombre)}
                          </span>
                          <span className={`text-sm truncate ${r.tú ? 'text-white font-black' : 'text-[var(--color-on-surface)]'}`}>
                            {r.nombre}{r.tú && ' (Tú)'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-on-surface-variant)]/70">{r.asistencias}</td>
                      <td className={`px-6 py-4 font-display font-black ${r.tú ? 'text-[var(--color-primary-fixed)]' : 'text-white'}`}>
                        {r.rating}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>

        {/* ── Ritmos de nado por distancia ── */}
        <Reveal delay={0.18}>
          <div>
            <div className="flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">speed</span>
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Chequeos de velocidad
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {RITMOS.map((r, i) => (
                <Reveal key={r.distancia} delay={0.2 + i * 0.05}>
                  <Card className="h-full">
                    <div className="flex items-center justify-between mb-5">
                      <span className="font-display text-headline-md font-black text-white">{r.distancia}</span>
                      <span className="font-display text-lg font-black text-[var(--color-primary-fixed)]">{r.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${r.pct}%` }}
                        transition={{ duration: 0.8, delay: 0.25 + i * 0.05, ease: EASE }}
                        className="h-full bg-[var(--color-primary-fixed)] rounded-full shadow-[0_0_12px_rgba(230,255,0,0.35)]"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <div>
                        <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-1">Tu mejor</p>
                        <p className="font-display font-black text-white">{r.mejor}</p>
                      </div>
                      <div className="text-right">
                        <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-1">Objetivo</p>
                        <p className="font-display font-black text-[var(--color-on-surface-variant)]/70">{r.objetivo}</p>
                      </div>
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
