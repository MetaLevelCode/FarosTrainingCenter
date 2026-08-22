'use client'

// ============================================================
// FAROS — Profesor · Mis Clases
// Lee colección `clases` filtradas por instructor_id == uid.
// Permite marcar asistencia y escribir observaciones.
// ============================================================

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import {
  getClasesProfesor, getAsistenciasClase,
  registrarAsistencia, updateObservacionesClase,
} from '@/lib/firestore'
import type { Clase, Asistencia } from '@/lib/types'
import { encolarAsistencia } from '@/lib/offlineQueue'

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

const ESTADO_COLOR: Record<Clase['estado'], string> = {
  programada: 'default',
  en_curso: 'primary',
  finalizada: 'success',
  cancelada: 'danger',
}

const ESTADO_LABEL: Record<Clase['estado'], string> = {
  programada: 'Programada',
  en_curso: 'En curso',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
}

export default function ClasesPage() {
  const { authorized, loading, user } = useRoleGuard(['profesor', 'admin'])
  const [clases, setClases] = useState<Clase[]>([])
  const [cargando, setCargando] = useState(true)
  const [claseAbierta, setClaseAbierta] = useState<string | null>(null)
  const [tabActiva, setTabActiva] = useState<'plan' | 'asistencia' | 'observaciones'>('plan')
  const [asistencias, setAsistencias] = useState<Record<string, Asistencia[]>>({})
  const [observaciones, setObservaciones] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getClasesProfesor(user.uid)
      .then((cs) => {
        setClases(cs)
        // Inicializar observaciones desde Firestore
        const obs: Record<string, string> = {}
        cs.forEach((c) => { obs[c.id] = c.observaciones_profesor ?? '' })
        setObservaciones(obs)
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [user])

  async function abrirClase(claseId: string) {
    if (claseAbierta === claseId) {
      setClaseAbierta(null)
      return
    }
    setClaseAbierta(claseId)
    setTabActiva('plan')
    if (!asistencias[claseId]) {
      try {
        const as = await getAsistenciasClase(claseId)
        setAsistencias((prev) => ({ ...prev, [claseId]: as }))
      } catch {}
    }
  }

  async function toggleAsistencia(claseId: string, usuarioId: string, nombreUsuario: string) {
    if (!user) return
    const lista = asistencias[claseId] ?? []
    const existente = lista.find((a) => a.usuarioId === usuarioId)
    const nuevoValor = !(existente?.asistio ?? false)

    // Optimistic update
    setAsistencias((prev) => {
      const copia = [...(prev[claseId] ?? [])]
      const idx = copia.findIndex((a) => a.usuarioId === usuarioId)
      if (idx >= 0) {
        copia[idx] = { ...copia[idx], asistio: nuevoValor }
      } else {
        copia.push({
          id: `temp-${usuarioId}`,
          asistenciaId: '',
          claseId, usuarioId,
          asistio: nuevoValor,
          fecha_registro: Date.now(),
          registradoPor: user.uid,
          creadoEn: Date.now(),
        })
      }
      return { ...prev, [claseId]: copia }
    })

    // Sin señal: se queda en cola y se sincroniza al volver la conexión.
    if (!navigator.onLine) {
      encolarAsistencia({ claseId, usuarioId, asistio: nuevoValor, profesorId: user.uid })
      return
    }

    try {
      await registrarAsistencia(claseId, usuarioId, nuevoValor, user.uid)
    } catch (err) {
      if (!navigator.onLine) {
        encolarAsistencia({ claseId, usuarioId, asistio: nuevoValor, profesorId: user.uid })
        return
      }
      console.error(err)
      // Error real (no de conectividad): revertir
      setAsistencias((prev) => {
        const copia = [...(prev[claseId] ?? [])]
        const idx = copia.findIndex((a) => a.usuarioId === usuarioId)
        if (idx >= 0) copia[idx] = { ...copia[idx], asistio: !nuevoValor }
        return { ...prev, [claseId]: copia }
      })
    }
  }

  async function guardarObservaciones(claseId: string) {
    if (!user) return
    setGuardando(claseId)
    try {
      await updateObservacionesClase(claseId, observaciones[claseId] ?? '', user.uid)
      setClases((prev) => prev.map((c) =>
        c.id === claseId ? { ...c, estado: 'finalizada', observaciones_profesor: observaciones[claseId] } : c,
      ))
    } catch (err) {
      console.error(err)
    } finally {
      setGuardando(null)
    }
  }

  const totalClases = clases.length
  const finalizadas = clases.filter((c) => c.estado === 'finalizada').length
  const pendientes = clases.filter((c) => c.estado === 'programada').length

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Mis Clases">
      <div className="space-y-8">

        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Tus sesiones</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Mis Clases
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total', value: String(totalClases), tone: 'white' },
            { label: 'Finalizadas', value: String(finalizadas), tone: 'primary' },
            { label: 'Programadas', value: String(pendientes), tone: 'white' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={0.05 * i}>
              <Card className="text-center">
                <p className={`font-display text-3xl font-black leading-none ${
                  s.tone === 'primary' ? 'text-[var(--color-primary-fixed)]' : 'text-white'
                }`}>{s.value}</p>
                <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-2">{s.label}</p>
              </Card>
            </Reveal>
          ))}
        </div>

        {cargando ? (
          <Reveal delay={0.1}>
            <Card><p className="text-sm text-[var(--color-on-surface-variant)]/40 text-center py-8">Cargando clases…</p></Card>
          </Reveal>
        ) : clases.length === 0 ? (
          <Reveal delay={0.1}>
            <Card>
              <p className="text-sm text-[var(--color-on-surface-variant)]/60 text-center py-8">
                No tienes clases asignadas aún. El administrador las creará y te asignará como instructor.
              </p>
            </Card>
          </Reveal>
        ) : (
          <div className="space-y-4">
            {clases.map((c, idx) => {
              const abierta = claseAbierta === c.id
              const inicio = new Date(c.fecha_hora_inicio)
              const fin = new Date(c.fecha_hora_fin)
              const listaAsistencia = asistencias[c.id] ?? []

              return (
                <Reveal key={c.id} delay={0.1 + idx * 0.04}>
                  <Card padding="none" className="overflow-hidden">
                    {/* Cabecera clickeable */}
                    <button
                      className="w-full p-6 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors duration-200"
                      onClick={() => abrirClase(c.id)}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="shrink-0 text-left">
                          <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">
                            {inicio.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).toUpperCase()}
                          </p>
                          <p className="font-display text-xl font-black text-white">
                            {inicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-display font-black text-white text-sm uppercase tracking-tight truncate">{c.nombre_clase}</p>
                          <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-0.5">
                            {c.sede} · {c.estudiantes_inscritos.length} inscritos
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={ESTADO_COLOR[c.estado] as any}>{ESTADO_LABEL[c.estado]}</Badge>
                        <span className="material-symbols-outlined text-white/40 text-[20px] transition-transform duration-300" style={{ transform: abierta ? 'rotate(180deg)' : 'none' }}>
                          expand_more
                        </span>
                      </div>
                    </button>

                    {/* Detalle expandido */}
                    {abierta && (
                      <div className="border-t border-white/10">
                        {/* Tabs */}
                        <div className="flex border-b border-white/10">
                          {(['plan', 'asistencia', 'observaciones'] as const).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setTabActiva(tab)}
                              className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-colors duration-200 ${
                                tabActiva === tab
                                  ? 'text-[var(--color-primary-fixed)] border-b-2 border-[var(--color-primary-fixed)]'
                                  : 'text-white/40 hover:text-white'
                              }`}
                            >
                              {tab === 'plan' ? 'Plan de clase' : tab === 'asistencia' ? 'Asistencia' : 'Observaciones'}
                            </button>
                          ))}
                        </div>

                        <div className="p-6">
                          {tabActiva === 'plan' && (
                            <ul className="space-y-3">
                              {(c.plan ?? []).length === 0 ? (
                                <li className="text-sm text-[var(--color-on-surface-variant)]/50">Sin plan de clase definido.</li>
                              ) : (c.plan ?? []).map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-[var(--color-on-surface-variant)]/85">
                                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-[17px] mt-0.5 shrink-0">check_circle</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          )}

                          {tabActiva === 'asistencia' && (
                            <div className="space-y-3">
                              {c.estudiantes_inscritos.length === 0 ? (
                                <p className="text-sm text-[var(--color-on-surface-variant)]/50">No hay estudiantes inscritos.</p>
                              ) : c.estudiantes_inscritos.map((uid) => {
                                const reg = listaAsistencia.find((a) => a.usuarioId === uid)
                                const presente = reg?.asistio ?? false
                                return (
                                  <div key={uid} className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                                    <div className="flex items-center gap-3">
                                      <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-black text-white">
                                        {uid.substring(0, 2).toUpperCase()}
                                      </span>
                                      <span className="text-sm text-white">{uid}</span>
                                    </div>
                                    <button
                                      onClick={() => toggleAsistencia(c.id, uid, uid)}
                                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                                        presente
                                          ? 'bg-[var(--color-success-emerald)]/20 text-[var(--color-success-emerald)] border border-[var(--color-success-emerald)]/30'
                                          : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/30'
                                      }`}
                                    >
                                      {presente ? 'Asistió ✓' : 'Marcar'}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {tabActiva === 'observaciones' && (
                            <div className="space-y-4">
                              <textarea
                                value={observaciones[c.id] ?? ''}
                                onChange={(e) => setObservaciones((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                placeholder="Escribe tus observaciones de la clase..."
                                rows={5}
                                className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/30 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors duration-300 resize-none"
                              />
                              <div className="flex justify-end">
                                <Button
                                  size="md"
                                  loading={guardando === c.id}
                                  onClick={() => guardarObservaciones(c.id)}
                                >
                                  {guardando === c.id ? 'Guardando…' : 'Guardar y finalizar clase'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                </Reveal>
              )
            })}
          </div>
        )}
      </div>
    </GuardedShell>
  )
}
