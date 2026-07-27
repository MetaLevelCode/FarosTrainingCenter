'use client'

// ============================================================
// FAROS — Entrenador · Alumnos
// Directorio de los alumnos a cargo del entrenador: búsqueda,
// plan, asistencia y tipo de clase (grupal / personalizada).
// ============================================================

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui'
import { ROSTER, describirPlan, pctAsistencia } from '@/lib/planes'

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

type Modalidad = 'todos' | 'grupal' | 'personal' | 'conjunto'

const ULTIMA: Record<string, string> = {
  'FR-0922': 'Ayer', 'FR-1045': 'Hoy', 'FR-0871': 'Hace 2 días',
  'FR-1198': 'Hace 5 días', 'FR-0634': 'Hace 8 días', 'FR-1302': 'Hoy',
}

// Los alumnos y sus planes salen del roster compartido: el coach ve
// exactamente el plan que el alumno contrató en el flujo.
const ALUMNOS = ROSTER.map((a) => {
  const info = describirPlan(a.plan)
  return {
    id: a.id,
    nombre: a.nombre,
    plan: info.etiqueta,
    tipoLabel: info.tipoLabel,
    modalidad: a.plan.tipo,
    sesionesMes: info.sesionesMes,
    asistidas: a.asistidas,
    asistencia: pctAsistencia(a),
    ultima: ULTIMA[a.id] ?? '—',
    estado: a.plan.estado === 'vencido' ? 'En riesgo' : 'Activo',
  }
})

function ini(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function AlumnosPage() {
  const { authorized, loading } = useRoleGuard(['entrenador', 'admin'])
  const [busqueda, setBusqueda] = useState('')
  const [modalidad, setModalidad] = useState<Modalidad>('todos')

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return ALUMNOS.filter((a) => {
      const okMod = modalidad === 'todos' || a.modalidad === modalidad
      const okQ = !q || a.nombre.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
      return okMod && okQ
    })
  }, [busqueda, modalidad])

  const activos = ALUMNOS.filter((a) => a.estado === 'Activo').length
  const enRiesgo = ALUMNOS.filter((a) => a.estado === 'En riesgo').length

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Alumnos">
      <div className="space-y-8">

        {/* ── Header ── */}
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">A tu cargo</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Alumnos
            </h2>
          </div>
        </Reveal>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total', value: String(ALUMNOS.length), tone: 'white' },
            { label: 'Activos', value: String(activos), tone: 'primary' },
            { label: 'En riesgo', value: String(enRiesgo), tone: 'danger' },
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

        {/* ── Directorio ── */}
        <Reveal delay={0.14}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02]">
              <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl w-fit" role="group" aria-label="Modalidad">
                {([['todos', 'Todos'], ['grupal', 'Grupal'], ['personal', 'Personal'], ['conjunto', 'Conjunto']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setModalidad(key)}
                    aria-pressed={modalidad === key}
                    className={`px-4 py-2 text-[10px] font-black rounded-lg uppercase tracking-widest transition-colors duration-200 ${
                      modalidad === key
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
                  placeholder="Buscar alumno..."
                  aria-label="Buscar alumno"
                  className="bg-white/5 border border-white/10 rounded-full pl-11 pr-5 py-3 text-xs w-full md:w-64 text-white placeholder:text-white/20 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors duration-300"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[680px]">
                <thead className="bg-white/5">
                  <tr>
                    {['Alumno', 'Plan', 'Modalidad', 'Asistencia', 'Última', 'Estado'].map((h) => (
                      <th key={h} className="px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {visibles.map((a) => (
                    <tr key={a.id} className="hover:bg-white/[0.03] transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[11px] font-black text-white shrink-0">
                            {ini(a.nombre)}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-white">{a.nombre}</p>
                            <p className="text-[10px] text-[var(--color-on-surface-variant)]/40 font-bold">ID: {a.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={a.modalidad === 'personal' ? 'primary' : 'default'}>{a.plan}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/70">{a.tipoLabel}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-[80px] h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                a.asistencia >= 80 ? 'bg-[var(--color-success-emerald)]'
                                : a.asistencia >= 60 ? 'bg-[var(--color-primary-fixed)]'
                                : 'bg-[var(--color-danger-crimson)]'
                              }`}
                              style={{ width: `${a.asistencia}%` }}
                            />
                          </div>
                          <span className="text-xs font-black text-white whitespace-nowrap">
                            {a.asistidas}<span className="text-[var(--color-on-surface-variant)]/40">/{a.sesionesMes}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-[var(--color-on-surface-variant)]/60 whitespace-nowrap">{a.ultima}</td>
                      <td className="px-6 py-4">
                        <Badge variant={a.estado === 'Activo' ? 'success' : 'danger'}>{a.estado}</Badge>
                      </td>
                    </tr>
                  ))}
                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-[var(--color-on-surface-variant)]/60">
                        Ningún alumno coincide con la búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
