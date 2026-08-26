'use client'

// ============================================================
// FAROS — Profesor · Mis Clases
// Lee colección `clases` filtradas por instructor_id == uid.
// Permite marcar asistencia y escribir observaciones.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import {
  getClasesProfesor, getAsistenciasClase, getUsuarios,
  registrarAsistencia, updateObservacionesClase, updateClasePlan,
} from '@/lib/firestore'
import { displayName } from '@/lib/types'
import type { Clase, Asistencia, Usuario } from '@/lib/types'
import { encolarAsistencia } from '@/lib/offlineQueue'
import { agruparPorCategoria, labelCategoria, proximaClase } from '@/lib/categoriaClase'

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
  const [alumnosMap, setAlumnosMap] = useState<Map<string, Usuario>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [claseAbierta, setClaseAbierta] = useState<string | null>(null)
  const [tabActiva, setTabActiva] = useState<'plan' | 'asistencia' | 'observaciones'>('plan')
  const [asistencias, setAsistencias] = useState<Record<string, Asistencia[]>>({})
  const [observaciones, setObservaciones] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const [categoriaAbierta, setCategoriaAbierta] = useState<string | null>(null)
  
  const [editandoPlan, setEditandoPlan] = useState<string | null>(null)
  const [bloquesText, setBloquesText] = useState('')
  const [guardandoPlan, setGuardandoPlan] = useState(false)

  async function guardarPlan(claseId: string) {
    if (!user) return
    const bloques = bloquesText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
    if (bloques.length === 0) {
      alert('Escribe al menos un paso en el plan de clase.')
      return
    }
    setGuardandoPlan(true)
    try {
      await updateClasePlan(claseId, bloques)
      setClases((prev) => prev.map((c) => (c.id === claseId ? { ...c, plan: bloques } : c)))
      setEditandoPlan(null)
    } catch (err) {
      console.error(err)
      alert('Error guardando el plan')
    } finally {
      setGuardandoPlan(false)
    }
  }

  useEffect(() => {
    if (!user) return
    Promise.all([getClasesProfesor(user.uid), getUsuarios('estudiante')])
      .then(([cs, estudiantes]) => {
        setClases(cs)
        setAlumnosMap(new Map(estudiantes.map((u) => [u.uid, u])))
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

  async function toggleAsistencia(claseId: string, usuarioId: string) {
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

  // La lista completa crece rápido con clases recurrentes (grupales +
  // personalizadas) — se muestra solo la más próxima suelta, el resto
  // agrupado por categoría y colapsado hasta que el profesor haga click.
  const proxima = useMemo(() => proximaClase(clases), [clases])
  const grupos = useMemo(
    () => agruparPorCategoria(clases.filter((c) => c.id !== proxima?.id)),
    [clases, proxima],
  )

  function renderClaseCard(c: Clase) {
    const abierta = claseAbierta === c.id
    const inicio = new Date(c.fecha_hora_inicio)
    const listaAsistencia = asistencias[c.id] ?? []

    return (
      <Card key={c.id} padding="none" className="overflow-hidden">
        {/* Cabecera clickeable — dos filas: la fecha/hora y el
            badge nunca dejan suficiente ancho al título/sede en
            una sola fila (se veía truncado a "T...", "ES..."
            en celular); separados, el título tiene todo el
            ancho de la tarjeta para sí solo. */}
        <button
          className="w-full p-6 flex flex-col gap-3 text-left hover:bg-white/[0.02] transition-colors duration-200"
          onClick={() => abrirClase(c.id)}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 shrink-0">
                {inicio.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).toUpperCase()}
              </span>
              <span className="font-display text-lg font-black text-white shrink-0">
                {inicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={ESTADO_COLOR[c.estado] as any} className="whitespace-nowrap">{ESTADO_LABEL[c.estado]}</Badge>
              <span className="material-symbols-outlined text-white/40 text-[20px] transition-transform duration-300" style={{ transform: abierta ? 'rotate(180deg)' : 'none' }}>
                expand_more
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-display font-black text-white text-sm uppercase tracking-tight truncate">{c.nombre_clase}</p>
            <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-0.5 truncate">
              {c.sede} · {c.estudiantes_inscritos.length} inscritos
            </p>
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
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-[var(--color-on-surface-variant)]/60">
                      {(c.plan ?? []).length > 0 ? 'Plan actual' : 'Sin plan de clase definido.'}
                    </p>
                    {editandoPlan !== c.id && (
                      <button 
                        onClick={() => {
                          setEditandoPlan(c.id)
                          setBloquesText((c.plan ?? []).join('\n'))
                        }}
                        className="label-caps text-[9px] text-[var(--color-primary-fixed)] hover:text-white transition-colors"
                      >
                        {(c.plan ?? []).length > 0 ? 'Editar plan' : 'Subir plan'}
                      </button>
                    )}
                  </div>
                  
                  {editandoPlan === c.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={bloquesText}
                        onChange={(e) => setBloquesText(e.target.value)}
                        rows={5}
                        placeholder={'Un paso por línea:\nCalentamiento: 400 m\n8 × 100 m al 80 %\nVuelta a la calma: 200 m'}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors resize-none"
                      />
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditandoPlan(null)}>Cancelar</Button>
                        <Button size="sm" loading={guardandoPlan} onClick={() => guardarPlan(c.id)}>Guardar plan</Button>
                      </div>
                    </div>
                  ) : (
                    (c.plan ?? []).length > 0 && (
                      <ul className="space-y-3">
                        {(c.plan ?? []).map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-[var(--color-on-surface-variant)]/85">
                            <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-[17px] mt-0.5 shrink-0">check_circle</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              )}

              {tabActiva === 'asistencia' && (
                <div className="space-y-3">
                  {c.estudiantes_inscritos.length === 0 ? (
                    <p className="text-sm text-[var(--color-on-surface-variant)]/50">No hay estudiantes inscritos.</p>
                  ) : c.estudiantes_inscritos.map((uid) => {
                    const reg = listaAsistencia.find((a) => a.usuarioId === uid)
                    const presente = reg?.asistio ?? false
                    const alumno = alumnosMap.get(uid)
                    const nombre = alumno ? displayName(alumno) : 'Alumno'
                    return (
                      <div key={uid} className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                          <span className="relative w-9 h-9 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-[11px] font-black text-white shrink-0">
                            {alumno?.foto_perfil ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={alumno.foto_perfil} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              nombre.substring(0, 2).toUpperCase()
                            )}
                          </span>
                          <span className="text-sm text-white truncate">{nombre}</span>
                        </div>
                        <button
                          onClick={() => toggleAsistencia(c.id, uid)}
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
    )
  }

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
          <div className="space-y-8">
            {proxima && (
              <Reveal delay={0.1}>
                <div>
                  <p className="label-caps text-[10px] text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Próxima clase</p>
                  {renderClaseCard(proxima)}
                </div>
              </Reveal>
            )}

            {grupos.size > 0 && (
              <Reveal delay={0.14}>
                <div>
                  <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mb-3 tracking-[0.3em]">Otras clases</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[...grupos.entries()].map(([codigo, lista]) => {
                      const abierta = categoriaAbierta === codigo
                      return (
                        <button
                          key={codigo}
                          onClick={() => setCategoriaAbierta(abierta ? null : codigo)}
                          className={`rounded-2xl border p-4 text-left transition-colors duration-200 ${
                            abierta
                              ? 'border-[var(--color-primary-fixed)] bg-[rgba(230,255,0,0.06)]'
                              : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                          }`}
                        >
                          <p className="font-display text-sm font-black text-white uppercase tracking-tight truncate">
                            {labelCategoria(codigo)}
                          </p>
                          <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-1">
                            {lista.length} {lista.length === 1 ? 'clase' : 'clases'}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                  {categoriaAbierta && grupos.get(categoriaAbierta) && (
                    <div className="space-y-4 mt-4">
                      {grupos.get(categoriaAbierta)!.map((c) => renderClaseCard(c))}
                    </div>
                  )}
                </div>
              </Reveal>
            )}

            {!proxima && grupos.size === 0 && (
              <Reveal delay={0.1}>
                <Card>
                  <p className="text-sm text-[var(--color-on-surface-variant)]/60 text-center py-8">
                    No tienes clases próximas.
                  </p>
                </Card>
              </Reveal>
            )}
          </div>
        )}
      </div>
    </GuardedShell>
  )
}
