'use client'

// ============================================================
// FAROS — Profesor · Estudiantes
// Lee de Firestore: usuarios donde rol == 'estudiante'.
// Muestra plan, asistencia del ciclo y estado de suscripción.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
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

function ini(u: Usuario) {
  return `${u.nombres.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase()
}

function nombreCompleto(u: Usuario) {
  return `${u.nombres} ${u.apellidos}`
}

function estadoSuscripcion(u: Usuario) {
  const s = u.suscripcionActiva
  if (!s) return 'Sin plan'
  return s.estado === 'activa' ? 'Activo' : 'Vencido'
}

export default function EstudiantesPage() {
  const { authorized, loading } = useRoleGuard(['profesor', 'admin'])
  const [estudiantes, setEstudiantes] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'vencido' | 'sin-plan'>('todos')

  useEffect(() => {
    getUsuarios('estudiante')
      .then(setEstudiantes)
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return estudiantes.filter((u) => {
      const nombre = nombreCompleto(u).toLowerCase()
      const okQ = !q || nombre.includes(q) || u.cedula?.includes(q)
      const estado = estadoSuscripcion(u)
      const okEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activo' && estado === 'Activo') ||
        (filtroEstado === 'vencido' && estado === 'Vencido') ||
        (filtroEstado === 'sin-plan' && estado === 'Sin plan')
      return okQ && okEstado
    })
  }, [estudiantes, busqueda, filtroEstado])

  const activos = estudiantes.filter((u) => u.suscripcionActiva?.estado === 'activa').length
  const enRiesgo = estudiantes.filter((u) => u.suscripcionActiva?.estado === 'vencida').length

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Estudiantes">
      <div className="space-y-8">

        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">A tu cargo</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Estudiantes
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total', value: String(estudiantes.length), tone: 'white' },
            { label: 'Activos', value: String(activos), tone: 'primary' },
            { label: 'Vencidos', value: String(enRiesgo), tone: 'danger' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={0.05 * i}>
              <Card className="text-center">
                <p className={`font-display text-3xl font-black leading-none ${
                  s.tone === 'primary' ? 'text-[var(--color-primary-fixed)]'
                  : s.tone === 'danger' ? 'text-[var(--color-danger-crimson)]' : 'text-white'
                }`}>{s.value}</p>
                <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-2">{s.label}</p>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.14}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02]">
              <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl w-fit flex-wrap gap-1" role="group">
                {([['todos', 'Todos'], ['activo', 'Activos'], ['vencido', 'Vencidos'], ['sin-plan', 'Sin plan']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFiltroEstado(key)}
                    aria-pressed={filtroEstado === key}
                    className={`px-4 py-2 text-[10px] font-black rounded-lg uppercase tracking-widest transition-colors duration-200 ${
                      filtroEstado === key
                        ? 'bg-[var(--color-primary-fixed)] text-black'
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-lg pointer-events-none">search</span>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar estudiante..."
                  aria-label="Buscar estudiante"
                  className="bg-white/5 border border-white/10 rounded-full pl-11 pr-5 py-3 text-xs w-full md:w-64 text-white placeholder:text-white/20 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors duration-300"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[680px]">
                <thead className="bg-white/5">
                  <tr>
                    {['Estudiante', 'Nivel', 'Plan activo', 'Asistencia', 'Sesiones restantes', 'Estado'].map((h) => (
                      <th key={h} className="px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cargando ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-[var(--color-on-surface-variant)]/40">Cargando…</td>
                    </tr>
                  ) : visibles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-[var(--color-on-surface-variant)]/60">
                        {estudiantes.length === 0 ? 'No hay estudiantes registrados aún.' : 'Ningún estudiante coincide.'}
                      </td>
                    </tr>
                  ) : visibles.map((u) => {
                    const susc = u.suscripcionActiva
                    const estado = estadoSuscripcion(u)
                    const tasa = u.estadisticas?.tasaAsistencia ?? 0
                    return (
                      <tr key={u.uid} className="hover:bg-white/[0.03] transition-colors duration-200">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[11px] font-black text-white shrink-0">
                              {ini(u)}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-white">{nombreCompleto(u)}</p>
                              <p className="text-[10px] text-[var(--color-on-surface-variant)]/40 font-bold">{u.sede || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/70">{u.nivel || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          {susc ? (
                            <Badge variant="default">{susc.nombrePlan}</Badge>
                          ) : (
                            <span className="text-[10px] text-[var(--color-on-surface-variant)]/40">Sin plan</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-[80px] h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  tasa >= 80 ? 'bg-[var(--color-success-emerald)]'
                                  : tasa >= 60 ? 'bg-[var(--color-primary-fixed)]'
                                  : 'bg-[var(--color-danger-crimson)]'
                                }`}
                                style={{ width: `${tasa}%` }}
                              />
                            </div>
                            <span className="text-xs font-black text-white whitespace-nowrap">{tasa}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--color-on-surface-variant)]/70 whitespace-nowrap">
                          {susc ? `${susc.sesionesRestantes} restantes` : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={estado === 'Activo' ? 'success' : estado === 'Vencido' ? 'danger' : 'default'}>
                            {estado}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
