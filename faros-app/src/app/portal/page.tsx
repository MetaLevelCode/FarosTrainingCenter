'use client'

// ============================================================
// FAROS — Portal Entrenador
// Ported from Stitch "portal_entrenador_particle_magnet_edition_v2":
// clases del día + carga de planes + reporte acumulado +
// registro de asistencia con toggles por alumno.
// ============================================================

import { useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button, Input } from '@/components/ui'
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
const CLASES = [
  {
    hora: '06:00', meridiano: 'AM', tipo: 'Grupal', titulo: 'Técnica de Mariposa',
    detalle: 'Piscina A • 12 atletas', estado: 'completado' as const,
  },
  {
    hora: '10:30', meridiano: 'AM', tipo: 'Grupal', titulo: 'Resistencia Aeróbica',
    detalle: 'Piscina A • 9 atletas', estado: 'completado' as const,
  },
  {
    hora: '05:30', meridiano: 'PM', tipo: 'Personal', titulo: 'Velocidad • Juan Pérez',
    detalle: 'Piscina B • Elite Pro', estado: 'en-curso' as const,
  },
  {
    hora: '07:00', meridiano: 'PM', tipo: 'Grupal', titulo: 'Aquafitness Nocturno',
    detalle: 'Piscina C • 15 atletas', estado: 'pendiente' as const,
  },
]

const ALUMNOS_INICIALES = [
  { id: 'FR-0922', nombre: 'Carlos Méndez', presente: true },
  { id: 'FR-1045', nombre: 'Sofía Ruiz', presente: false },
  { id: 'FR-0871', nombre: 'Diego Morales', presente: true },
  { id: 'FR-1198', nombre: 'Valentina Castro', presente: false },
  { id: 'FR-0634', nombre: 'Andrés Rojas', presente: false },
  { id: 'FR-1302', nombre: 'Mariana Duque', presente: true },
]

function iniciales(nombre: string) {
  return nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function PortalPage() {
  const { authorized, loading } = useRoleGuard(['entrenador', 'admin'])
  const { user } = useAuth()
  const firstName = user?.displayName?.split(' ')[0] ?? 'Coach'

  const [alumnos, setAlumnos] = useState(ALUMNOS_INICIALES)
  const [busqueda, setBusqueda] = useState('')
  const [enviado, setEnviado] = useState(false)
  const asistenciaRef = useRef<HTMLDivElement>(null)

  const presentes = alumnos.filter((a) => a.presente).length
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return alumnos
    return alumnos.filter((a) => a.nombre.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
  }, [alumnos, busqueda])

  function togglePresente(id: string) {
    setEnviado(false)
    setAlumnos((prev) => prev.map((a) => (a.id === id ? { ...a, presente: !a.presente } : a)))
  }

  const hoy = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date())
    .toUpperCase()

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Portal Entrenador">
      <div className="space-y-8">

        {/* ── Header + stats ── */}
        <Reveal>
          <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="h-px w-8 bg-[var(--color-primary-fixed)]" />
                <span className="label-caps text-[var(--color-primary-fixed)] tracking-[0.3em]">Portal de Entrenador</span>
              </div>
              <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase mb-4">
                Hola,<br />Coach {firstName}
              </h2>
              <p className="text-[var(--color-on-surface-variant)]/80 max-w-xl border-l border-white/20 pl-6">
                Gestiona tus sesiones de hoy y registra el rendimiento de tus atletas de alto rendimiento.
              </p>
            </div>
            <Card className="shrink-0">
              <div className="flex items-center gap-8 px-2">
                <div className="text-center">
                  <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mb-1">Sesiones mes</p>
                  <p className="font-display text-3xl font-black text-[var(--color-primary-fixed)]">42</p>
                </div>
                <span className="h-12 w-px bg-white/10" />
                <div className="text-center">
                  <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mb-1">Horas totales</p>
                  <p className="font-display text-3xl font-black text-[var(--color-primary-fixed)]">128</p>
                </div>
              </div>
            </Card>
          </section>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Clases de hoy ── */}
          <div className="lg:col-span-8">
            <Reveal delay={0.08}>
              <Card padding="none" className="overflow-hidden">
                <div className="p-6 md:p-8 flex flex-wrap justify-between items-center gap-4 border-b border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <span className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">event_available</span>
                    </span>
                    <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                      Mis Clases de Hoy
                    </h3>
                  </div>
                  <span className="label-caps text-[10px] px-4 py-2 rounded-full border border-white/10 text-[var(--color-on-surface-variant)]">
                    {hoy}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[640px]">
                    <thead className="bg-white/5">
                      <tr>
                        {['Hora', 'Tipo', 'Plan / Grupo', 'Estado', ''].map((h) => (
                          <th key={h} className="px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {CLASES.map((c) => {
                        const enCurso = c.estado === 'en-curso'
                        return (
                          <tr
                            key={`${c.hora}${c.titulo}`}
                            className={enCurso ? 'bg-[rgba(230,255,0,0.03)]' : 'hover:bg-white/[0.03] transition-colors duration-200'}
                          >
                            <td className="px-6 py-5 whitespace-nowrap">
                              <span className={`font-display font-black text-lg ${enCurso ? 'text-[var(--color-primary-fixed)]' : 'text-white'}`}>
                                {c.hora}
                              </span>
                              <span className="text-xs text-[var(--color-on-surface-variant)]/50 ml-1">{c.meridiano}</span>
                            </td>
                            <td className="px-6 py-5">
                              <Badge variant={c.tipo === 'Personal' ? 'primary' : 'default'}>{c.tipo}</Badge>
                            </td>
                            <td className="px-6 py-5">
                              <p className="font-display text-sm font-extrabold text-white uppercase tracking-wide">{c.titulo}</p>
                              <p className="text-[11px] text-[var(--color-on-surface-variant)]/60 mt-1">{c.detalle}</p>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              {c.estado === 'completado' && (
                                <span className="flex items-center gap-2 text-[var(--color-success-emerald)] text-[11px] font-black tracking-widest uppercase">
                                  <span className="w-2 h-2 rounded-full bg-[var(--color-success-emerald)] shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                  Completado
                                </span>
                              )}
                              {c.estado === 'en-curso' && (
                                <span className="flex items-center gap-2 text-[var(--color-primary-fixed)] text-[11px] font-black tracking-widest uppercase">
                                  <span className="w-2 h-2 rounded-full bg-[var(--color-primary-fixed)] shadow-[0_0_10px_rgba(230,255,0,0.8)] animate-pulse" />
                                  En Curso
                                </span>
                              )}
                              {c.estado === 'pendiente' && (
                                <span className="flex items-center gap-2 text-[var(--color-on-surface-variant)]/60 text-[11px] font-black tracking-widest uppercase">
                                  <span className="w-2 h-2 rounded-full bg-white/20" />
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-5 text-right">
                              {enCurso ? (
                                <Button
                                  size="sm"
                                  onClick={() => asistenciaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                >
                                  Pasar Lista
                                </Button>
                              ) : (
                                <button className="label-caps text-[10px] text-[var(--color-primary-fixed)] border-b border-[rgba(230,255,0,0.3)] pb-0.5 hover:text-white hover:border-white/30 transition-colors duration-200">
                                  Ver Resumen
                                </button>
                              )}
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

          {/* ── Columna lateral ── */}
          <div className="lg:col-span-4 space-y-6">
            <Reveal delay={0.16}>
              <Card>
                <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-6 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)] p-2.5 rounded-xl bg-white/5 border border-white/5">upload_file</span>
                  Carga de Planes
                </h3>
                <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                  <Input label="Título del plan" placeholder="Ej: Macro-Ciclo Noviembre" />
                  <label className="block border-2 border-dashed border-white/10 rounded-3xl p-8 text-center hover:border-[rgba(230,255,0,0.4)] hover:bg-white/[0.04] transition-[border-color,background-color] duration-300 cursor-pointer group">
                    <input type="file" accept=".pdf,.xls,.xlsx" className="sr-only" />
                    <span className="material-symbols-outlined text-white/20 text-4xl mb-3 group-hover:text-[var(--color-primary-fixed)] transition-colors duration-300 block">
                      cloud_upload
                    </span>
                    <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60">
                      Arrastra archivo PDF o Excel
                    </span>
                  </label>
                  <Button type="submit" variant="outline" fullWidth>Enviar a Revisión</Button>
                </form>
              </Card>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="bg-[var(--color-primary-fixed)] p-8 rounded-2xl text-black flex flex-col justify-between gap-8 shadow-[0_20px_50px_-12px_rgba(230,255,0,0.3)] hover:scale-[1.01] transition-transform duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="label-caps text-[10px] opacity-50 mb-2">Reporte acumulado</p>
                    <h4 className="font-display text-2xl font-black uppercase leading-tight tracking-tight">
                      Envío de Clases
                    </h4>
                  </div>
                  <span className="w-12 h-12 bg-black/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">trending_up</span>
                  </span>
                </div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <span className="font-display text-5xl font-black tracking-tighter">18</span>
                    <span className="label-caps text-[10px] ml-3 opacity-70">Sin reportar</span>
                  </div>
                  <button className="bg-black text-[var(--color-primary-fixed)] px-6 py-3.5 rounded-2xl label-caps text-[10px] flex items-center gap-2 active:scale-[0.97] transition-transform duration-150 shrink-0">
                    Reportar
                    <span className="material-symbols-outlined text-sm">send</span>
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ── Registro de asistencia ── */}
        <div ref={asistenciaRef} className="scroll-mt-24">
          <Reveal delay={0.3}>
            <Card padding="none" className="overflow-hidden">
              <div className="p-6 md:p-8 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white/[0.02]">
                <div>
                  <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight flex items-center gap-3">
                    <span className="material-symbols-outlined text-[var(--color-primary-fixed)] p-2.5 rounded-xl bg-white/5 border border-white/5">checklist</span>
                    Registro de Asistencia
                  </h3>
                  <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-2">
                    Clase: Velocidad • Piscina B (17:30 – 18:30)
                  </p>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-lg pointer-events-none">search</span>
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar alumno..."
                    aria-label="Buscar alumno"
                    className="bg-white/5 border border-white/10 rounded-full pl-11 pr-5 py-3 text-xs w-full md:w-72 text-white placeholder:text-white/20 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors duration-300"
                  />
                </div>
              </div>

              <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibles.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between p-5 rounded-3xl border transition-[border-color,background-color] duration-300 ${
                      a.presente
                        ? 'border-[rgba(230,255,0,0.35)] bg-[rgba(230,255,0,0.05)]'
                        : 'border-white/5 bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[12px] font-black shrink-0 border-2 transition-colors duration-300 ${
                          a.presente
                            ? 'bg-[var(--color-primary-fixed)] text-black border-transparent'
                            : 'bg-white/10 text-white border-white/10'
                        }`}
                      >
                        {iniciales(a.nombre)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-black uppercase text-white tracking-wide truncate">{a.nombre}</p>
                        <p className="text-[10px] text-[var(--color-on-surface-variant)]/50 font-bold mt-0.5">ID: {a.id}</p>
                      </div>
                    </div>
                    <button
                      role="switch"
                      aria-checked={a.presente}
                      aria-label={`Asistencia de ${a.nombre}`}
                      onClick={() => togglePresente(a.id)}
                      className={`relative w-12 h-6 rounded-full shrink-0 transition-colors duration-300 ${
                        a.presente ? 'bg-[var(--color-primary-fixed)]' : 'bg-white/10'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 ${
                          a.presente ? 'translate-x-6 bg-black' : 'translate-x-0 bg-white/40'
                        }`}
                        style={{ transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
                      />
                    </button>
                  </div>
                ))}
                {visibles.length === 0 && (
                  <p className="col-span-full text-center text-sm text-[var(--color-on-surface-variant)]/60 py-8">
                    Ningún alumno coincide con “{busqueda}”.
                  </p>
                )}
              </div>

              <div className="bg-black/40 px-6 md:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-white/10">
                <div className="flex items-center gap-5">
                  <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">Asistencia actual</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-black text-[var(--color-primary-fixed)]">{presentes}</span>
                    <span className="text-xs font-black text-white/20">/ {alumnos.length} alumnos</span>
                  </div>
                </div>
                <Button size="md" onClick={() => setEnviado(true)} disabled={enviado}>
                  {enviado ? 'Asistencia enviada ✓' : 'Cerrar sesión y enviar'}
                </Button>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </GuardedShell>
  )
}
