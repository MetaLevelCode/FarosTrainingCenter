'use client'

// ============================================================
// FAROS — Estudiante · Ranking
// Lee todos los estudiantes de Firestore y los ordena por
// tasaAsistencia de sus estadísticas.
// ============================================================

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui'
import { getUsuarios } from '@/lib/firestore'
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

const PODIO_STYLE: Record<number, { ring: string; medal: string }> = {
  1: { ring: 'border-[var(--color-primary-fixed)]', medal: 'text-[var(--color-primary-fixed)]' },
  2: { ring: 'border-white/40', medal: 'text-white/70' },
  3: { ring: 'border-[#c47a3d]/60', medal: 'text-[#c47a3d]' },
}

function ini(u: Usuario) {
  return `${u.nombres.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase()
}

function nombreCompleto(u: Usuario) {
  return `${u.nombres} ${u.apellidos}`
}

type RankEntry = {
  uid: string
  nombre: string
  tasa: number
  asistidas: number
  pos: number
  esYo: boolean
}

export default function RankingPage() {
  const { authorized, loading, user } = useRoleGuard(['estudiante'])
  const [ranking, setRanking] = useState<RankEntry[]>([])
  const [cargando, setCargando] = useState(true)
  const [rango, setRango] = useState<'general' | 'mensual'>('general')

  useEffect(() => {
    getUsuarios('estudiante')
      .then((estudiantes) => {
        const sorted = [...estudiantes]
          .sort((a, b) => (b.estadisticas?.tasaAsistencia ?? 0) - (a.estadisticas?.tasaAsistencia ?? 0))
          .map((u, i) => ({
            uid: u.uid,
            nombre: nombreCompleto(u),
            tasa: u.estadisticas?.tasaAsistencia ?? 0,
            asistidas: u.estadisticas?.clasesAsistidas ?? 0,
            pos: i + 1,
            esYo: u.uid === user?.uid,
          }))
        setRanking(sorted)
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [user?.uid])

  const podio = ranking.slice(0, 3)
  const yo = ranking.find((r) => r.esYo)
  const miNombre = user ? `${user.nombres} ${user.apellidos}` : 'Tú'

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Ranking">
      <div className="space-y-8">

        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Standings de élite</p>
              <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
                Ranking
              </h2>
            </div>
            <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl" role="group">
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

        {cargando ? (
          <Reveal delay={0.05}>
            <Card>
              <p className="text-sm text-[var(--color-on-surface-variant)]/40 text-center py-8">Cargando ranking…</p>
            </Card>
          </Reveal>
        ) : ranking.length === 0 ? (
          <Reveal delay={0.05}>
            <Card>
              <p className="text-sm text-[var(--color-on-surface-variant)]/60 text-center py-8">
                Aún no hay suficientes estudiantes para mostrar el ranking.
              </p>
            </Card>
          </Reveal>
        ) : (
          <>
            {/* ── Podio ── */}
            {podio.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 md:gap-6">
                {[podio[1], podio[0], podio[2]].map((p, idx) => {
                  const destacado = p.pos === 1
                  const st = PODIO_STYLE[p.pos]
                  return (
                    <Reveal key={p.pos} delay={0.05 * idx}>
                      <Card className={`text-center ${destacado ? '!border-[rgba(230,255,0,0.4)] md:-translate-y-3' : ''}`}>
                        <div className="flex flex-col items-center">
                          <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full border-2 ${st.ring} flex items-center justify-center mb-4`}>
                            <span className="font-display text-lg md:text-xl font-black text-white">{p.nombre.charAt(0)}{p.nombre.split(' ')[1]?.charAt(0) ?? ''}</span>
                            <span className={`absolute -bottom-2 material-symbols-outlined text-[22px] ${st.medal} bg-[#0a0a0a] rounded-full`}>
                              {destacado ? 'emoji_events' : 'military_tech'}
                            </span>
                          </div>
                          <span className={`font-display font-black leading-none mb-1 ${destacado ? 'text-2xl md:text-3xl text-[var(--color-primary-fixed)]' : 'text-xl text-white'}`}>
                            #{p.pos}
                          </span>
                          <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/70 truncate max-w-full">{p.nombre}</span>
                          <span className="font-display text-sm font-black text-white mt-2">{p.tasa}%</span>
                        </div>
                      </Card>
                    </Reveal>
                  )
                })}
              </div>
            )}

            {/* ── Tu posición ── */}
            {yo && (
              <Reveal delay={0.1}>
                <div className="rounded-2xl border border-[rgba(230,255,0,0.3)] bg-[rgba(230,255,0,0.06)] p-5 flex items-center gap-4">
                  <span className="font-display text-2xl font-black text-[var(--color-primary-fixed)] w-10 text-center shrink-0">#{yo.pos}</span>
                  <span className="w-11 h-11 rounded-full bg-[var(--color-primary-fixed)] text-black flex items-center justify-center font-black text-sm shrink-0">
                    {miNombre.charAt(0)}{miNombre.split(' ')[1]?.charAt(0) ?? ''}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-black text-white uppercase tracking-tight truncate">{miNombre} (Tú)</p>
                    <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mt-0.5">{yo.asistidas} asistencias registradas</p>
                  </div>
                  <span className="font-display text-xl font-black text-[var(--color-primary-fixed)] shrink-0">{yo.tasa}%</span>
                </div>
              </Reveal>
            )}

            {/* ── Tabla completa ── */}
            <Reveal delay={0.14}>
              <Card padding="none" className="overflow-hidden">
                <div className="p-6 md:p-8 border-b border-white/10 bg-white/[0.02]">
                  <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">Tabla completa</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[520px]">
                    <thead className="bg-white/5">
                      <tr>
                        {['#', 'Estudiante', 'Asistencias', 'Tasa'].map((h) => (
                          <th key={h} className="px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {ranking.map((r) => (
                        <tr key={r.uid} className={r.esYo ? 'bg-[rgba(230,255,0,0.06)]' : 'hover:bg-white/[0.03] transition-colors duration-200'}>
                          <td className={`px-6 py-4 font-display font-black ${r.esYo ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/40'}`}>
                            {r.pos}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                                r.esYo ? 'bg-[var(--color-primary-fixed)] text-black' : 'bg-white/10 text-white border border-white/10'
                              }`}>
                                {r.nombre.charAt(0)}{r.nombre.split(' ')[1]?.charAt(0) ?? ''}
                              </span>
                              <span className={`text-sm truncate ${r.esYo ? 'text-white font-black' : 'text-[var(--color-on-surface)]'}`}>
                                {r.nombre}{r.esYo && ' (Tú)'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-[var(--color-on-surface-variant)]/70">{r.asistidas}</td>
                          <td className={`px-6 py-4 font-display font-black ${r.esYo ? 'text-[var(--color-primary-fixed)]' : 'text-white'}`}>
                            {r.tasa}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Reveal>
          </>
        )}
      </div>
    </GuardedShell>
  )
}
