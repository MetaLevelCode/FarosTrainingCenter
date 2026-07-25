'use client'

// ============================================================
// FAROS — Entrenador · Mis Clases
// Requisitos (notas ③ Entrenadores):
//  - Sus clases; al abrir una, alterna entre "Plan de clase" y
//    "Observaciones de clases"
//  - Ver asistencia según sea grupal o personalizada
//  - Acumulado de clases dictadas (se reporta al admin)
// ============================================================

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'

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
type Clase = {
  id: string
  hora: string
  titulo: string
  tipo: 'Grupal' | 'Personal'
  piscina: string
  estado: 'completado' | 'en-curso' | 'pendiente'
  plan: string[]
  observaciones: string
  asistentes: { nombre: string; presente: boolean }[]
}

const CLASES: Clase[] = [
  {
    id: 'c1', hora: '06:00 AM', titulo: 'Técnica de Mariposa', tipo: 'Grupal', piscina: 'Piscina A',
    estado: 'completado',
    plan: [
      'Calentamiento: 400 m libre progresivo',
      'Técnica: 6 × 50 m mariposa con tabla',
      'Series: 4 × 100 m ritmo controlado',
      'Vuelta a la calma: 200 m suave',
    ],
    observaciones: 'Grupo con buena coordinación de brazada. Insistir en la patada de delfín desde cadera. Sofía R. mejoró el timing respiratorio.',
    asistentes: [
      { nombre: 'Carlos Méndez', presente: true },
      { nombre: 'Sofía Ruiz', presente: true },
      { nombre: 'Diego Morales', presente: true },
      { nombre: 'Valentina Castro', presente: false },
      { nombre: 'Andrés Rojas', presente: true },
    ],
  },
  {
    id: 'c2', hora: '05:30 PM', titulo: 'Velocidad · Juan Pérez', tipo: 'Personal', piscina: 'Piscina B',
    estado: 'en-curso',
    plan: [
      'Activación: 300 m mixto',
      'Sprints: 8 × 50 m al 90% con descanso 1:30',
      'Salidas de poyete: 6 repeticiones',
      'Soltar: 200 m espalda',
    ],
    observaciones: 'Trabajar la fase subacuática tras la salida. Objetivo < 31 s en los 50 m. Revisar entrada de mano.',
    asistentes: [
      { nombre: 'Juan Pérez', presente: true },
    ],
  },
  {
    id: 'c3', hora: '07:00 PM', titulo: 'Aquafitness Nocturno', tipo: 'Grupal', piscina: 'Piscina C',
    estado: 'pendiente',
    plan: [
      'Movilidad articular en el agua: 10 min',
      'Circuito cardiovascular: 3 rondas',
      'Fuerza con flotadores: 4 estaciones',
      'Estiramiento guiado: 10 min',
    ],
    observaciones: '—',
    asistentes: [
      { nombre: 'Mariana Duque', presente: false },
      { nombre: 'Luis Torres', presente: false },
      { nombre: 'Andrea Ríos', presente: false },
    ],
  },
]

function ini(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

const ESTADO_BADGE: Record<Clase['estado'], { label: string; variant: 'success' | 'primary' | 'default' }> = {
  completado: { label: 'Completado', variant: 'success' },
  'en-curso': { label: 'En curso', variant: 'primary' },
  pendiente: { label: 'Pendiente', variant: 'default' },
}

export default function ClasesPage() {
  const { authorized, loading } = useRoleGuard(['entrenador', 'admin'])
  const [selId, setSelId] = useState(CLASES[0].id)
  const [tab, setTab] = useState<'plan' | 'obs'>('plan')
  const [reportado, setReportado] = useState(false)

  const sel = useMemo(() => CLASES.find((c) => c.id === selId)!, [selId])
  const dictadas = CLASES.filter((c) => c.estado === 'completado').length
  const presentes = sel.asistentes.filter((a) => a.presente).length

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Mis Clases">
      <div className="space-y-8">

        {/* ── Header ── */}
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Sesiones de hoy</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Mis Clases
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Lista de clases ── */}
          <div className="lg:col-span-5 space-y-4">
            {CLASES.map((c, i) => {
              const activa = c.id === selId
              return (
                <Reveal key={c.id} delay={0.06 * i}>
                  <button
                    onClick={() => { setSelId(c.id); setTab('plan') }}
                    className={`w-full text-left rounded-2xl p-5 border transition-[border-color,background-color,transform] duration-300 active:scale-[0.99] ${
                      activa
                        ? 'border-[rgba(230,255,0,0.4)] bg-[rgba(230,255,0,0.05)]'
                        : 'border-white/5 bg-white/[0.03] hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-display font-black ${activa ? 'text-[var(--color-primary-fixed)]' : 'text-white'}`}>
                        {c.hora}
                      </span>
                      <Badge variant={ESTADO_BADGE[c.estado].variant}>{ESTADO_BADGE[c.estado].label}</Badge>
                    </div>
                    <p className="font-display text-sm font-extrabold text-white uppercase tracking-tight">{c.titulo}</p>
                    <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1">
                      {c.tipo} · {c.piscina} · {c.asistentes.length} {c.asistentes.length === 1 ? 'atleta' : 'atletas'}
                    </p>
                  </button>
                </Reveal>
              )
            })}

            {/* Acumulado → reporte al admin */}
            <Reveal delay={0.24}>
              <div className="bg-[var(--color-primary-fixed)] p-6 rounded-2xl text-black flex flex-col gap-5 shadow-[0_20px_50px_-12px_rgba(230,255,0,0.3)]">
                <div>
                  <p className="label-caps text-[10px] opacity-50 mb-1">Acumulado del mes</p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-4xl font-black">{dictadas}</span>
                    <span className="label-caps text-[10px] opacity-70">clases dictadas</span>
                  </div>
                </div>
                <button
                  onClick={() => setReportado(true)}
                  disabled={reportado}
                  className="bg-black text-[var(--color-primary-fixed)] px-6 py-3.5 rounded-2xl label-caps text-[10px] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform duration-150 disabled:opacity-70"
                >
                  {reportado ? 'Reportado a admin ✓' : 'Reportar a administración'}
                  {!reportado && <span className="material-symbols-outlined text-sm">send</span>}
                </button>
              </div>
            </Reveal>
          </div>

          {/* ── Detalle ── */}
          <div className="lg:col-span-7">
            <Reveal delay={0.12}>
              <Card padding="none" className="overflow-hidden">
                {/* Cabecera del detalle */}
                <div className="p-6 md:p-8 border-b border-white/10 bg-white/[0.02]">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                      {sel.titulo}
                    </h3>
                    <Badge variant={sel.tipo === 'Personal' ? 'primary' : 'default'}>{sel.tipo}</Badge>
                  </div>
                  {/* Tabs Plan / Observaciones */}
                  <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl w-fit" role="tablist">
                    {([['plan', 'Plan de clase'], ['obs', 'Observaciones']] as const).map(([key, label]) => (
                      <button
                        key={key}
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => setTab(key)}
                        className={`relative px-5 py-2 text-[10px] font-black rounded-lg uppercase tracking-widest transition-colors duration-200 ${
                          tab === key ? 'text-black' : 'text-white/40 hover:text-white'
                        }`}
                      >
                        {tab === key && (
                          <motion.span
                            layoutId="clase-tab"
                            className="absolute inset-0 rounded-lg bg-[var(--color-primary-fixed)]"
                            transition={{ duration: 0.3, ease: EASE }}
                          />
                        )}
                        <span className="relative z-10">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contenido de la pestaña — re-monta con key para animar
                    la entrada sin depender de una salida (más fiable que
                    AnimatePresence mode="wait" para contenido siempre visible). */}
                <div className="p-6 md:p-8">
                  <motion.div
                    key={`${selId}-${tab}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                  >
                    {tab === 'plan' ? (
                      <ul className="space-y-4">
                        {sel.plan.map((paso, i) => (
                          <li key={i} className="flex items-baseline gap-4">
                            <span className="text-[12px] font-black text-[rgba(230,255,0,0.6)] shrink-0">0{i + 1}</span>
                            <span className="text-[var(--color-on-surface)]/85">{paso}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                        <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mb-3">Notas de la sesión</p>
                        <p className="text-[var(--color-on-surface)]/90 italic leading-relaxed">
                          {sel.observaciones === '—' ? 'Sin observaciones registradas todavía.' : `“${sel.observaciones}”`}
                        </p>
                      </div>
                    )}
                  </motion.div>

                  {/* Asistencia (grupal o personalizada) */}
                  <div className="mt-8 pt-8 border-t border-white/5">
                    <div className="flex items-center justify-between mb-5">
                      <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">
                        Asistencia {sel.tipo === 'Personal' ? 'personalizada' : 'grupal'}
                      </p>
                      <span className="label-caps text-[10px] text-[var(--color-primary-fixed)]">
                        {presentes} / {sel.asistentes.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {sel.asistentes.map((a) => (
                        <div key={a.nombre} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                            a.presente ? 'bg-[var(--color-primary-fixed)] text-black' : 'bg-white/10 text-white/50 border border-white/10'
                          }`}>
                            {ini(a.nombre)}
                          </span>
                          <span className="flex-1 text-sm text-white">{a.nombre}</span>
                          {a.presente
                            ? <Badge variant="success">Asistió</Badge>
                            : <Badge variant="default">Sin registro</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </Reveal>
          </div>
        </div>
      </div>
    </GuardedShell>
  )
}
