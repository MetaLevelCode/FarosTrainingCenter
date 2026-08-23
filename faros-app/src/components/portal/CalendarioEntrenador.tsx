'use client'

// ============================================================
// FAROS — Calendario del entrenador
// El portal del coach es un gran calendario. Cada día muestra sus
// clases reales (Firestore: clases donde instructor_id == uid); al
// abrir una clase, el coach ve/sube el PLAN DE CLASE (campo `plan` en
// el doc, ya habilitado en firestore.rules) y registra la ASISTENCIA
// real de ese día (registrarAsistencia — la misma función que usa
// /portal/clases).
//
// Los mensajes siguen siendo locales/demo: no existe todavía una
// colección de mensajería en Firestore (esa es una feature aparte,
// no un simple "conectar lo que ya existe").
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Card, Button, Badge, Spinner } from '@/components/ui'
import { Conversacion } from '@/components/shared/Conversacion'
import { useAuth } from '@/contexts/AuthContext'
import {
  getClasesProfesor, getAsistenciasClase, registrarAsistencia,
  updateClasePlan, updateObservacionesClase, getUsuarios,
} from '@/lib/firestore'
import { displayName } from '@/lib/types'
import type { Clase, Asistencia, Usuario } from '@/lib/types'
import { encolarAsistencia } from '@/lib/offlineQueue'
import {
  mensajesSemilla, delCanal, nuevoMensaje, canalGrupo, canalPrivado,
  COACH_ID, COACH_NOMBRE, type Mensaje,
} from '@/lib/mensajes'

const EASE = [0.22, 1, 0.36, 1] as const

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ESTADO_LABEL: Record<Clase['estado'], string> = {
  programada: 'Programada',
  en_curso: 'En curso',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
}
const ESTADO_BADGE: Record<Clase['estado'], 'default' | 'primary' | 'success' | 'danger'> = {
  programada: 'default',
  en_curso: 'primary',
  finalizada: 'success',
  cancelada: 'danger',
}

const pad = (n: number) => String(n).padStart(2, '0')
const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function horaAmPm(ts: number): { hora: string; ampm: 'AM' | 'PM' } {
  const d = new Date(ts)
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
  const h12 = d.getHours() % 12 || 12
  return { hora: `${h12}:${pad(d.getMinutes())}`, ampm }
}

// ── Rejilla del mes (semanas lunes a domingo) ──
interface Celda { fecha: Date | null; iso: string; clases: Clase[] }
const aDow = (jsDay: number) => (jsDay === 0 ? 7 : jsDay)

function mallaDelMes(anio: number, mes: number, clasesPorDia: Map<string, Clase[]>): Celda[][] {
  const primero = new Date(anio, mes, 1)
  const offset = aDow(primero.getDay()) - 1
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()

  const celdas: Celda[] = []
  for (let i = 0; i < offset; i++) celdas.push({ fecha: null, iso: `pad-${i}`, clases: [] })
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = new Date(anio, mes, d)
    const iso = isoDe(fecha)
    celdas.push({ fecha, iso, clases: clasesPorDia.get(iso) ?? [] })
  }
  while (celdas.length % 7 !== 0) celdas.push({ fecha: null, iso: `pad-fin-${celdas.length}`, clases: [] })

  const semanas: Celda[][] = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))
  return semanas
}

/** Id del muro de mensajes de una clase (demo local — sin backend real todavía). */
function grupoDeClase(clase: Clase): string {
  return clase.nombre_clase.toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '') || clase.id
}

export function CalendarioEntrenador() {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [cursor, setCursor] = useState({ anio: 2026, mes: 6 })
  const [selIso, setSelIso] = useState<string | null>(null)
  const [hoyIso, setHoyIso] = useState<string | null>(null)

  const [cargando, setCargando] = useState(true)
  const [clases, setClases] = useState<Clase[]>([])
  const [alumnosMap, setAlumnosMap] = useState<Map<string, Usuario>>(new Map())
  const [asistenciasPorClase, setAsistenciasPorClase] = useState<Record<string, Asistencia[]>>({})

  // Mensajes: demo local, sin backend real (ver comentario del archivo).
  const [mensajes, setMensajes] = useState<Mensaje[]>(() => mensajesSemilla())
  function enviarMensaje(canalId: string, texto: string) {
    setMensajes((prev) => [...prev, nuevoMensaje(canalId, COACH_ID, COACH_NOMBRE, 'entrenador', texto)])
  }

  useEffect(() => {
    const hoy = new Date()
    setCursor({ anio: hoy.getFullYear(), mes: hoy.getMonth() })
    setSelIso(isoDe(hoy))
    setHoyIso(isoDe(hoy))
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!user?.uid) return
    Promise.all([getClasesProfesor(user.uid), getUsuarios('estudiante')])
      .then(([cs, estudiantes]) => {
        setClases(cs)
        setAlumnosMap(new Map(estudiantes.map((u) => [u.uid, u])))
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [user?.uid])

  const clasesPorDia = useMemo(() => {
    const m = new Map<string, Clase[]>()
    for (const c of clases) {
      const iso = isoDe(new Date(c.fecha_hora_inicio))
      const arr = m.get(iso) ?? []
      arr.push(c)
      m.set(iso, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => a.fecha_hora_inicio - b.fecha_hora_inicio)
    return m
  }, [clases])

  const semanas = useMemo(() => mallaDelMes(cursor.anio, cursor.mes, clasesPorDia), [cursor, clasesPorDia])
  const clasesSel = selIso ? (clasesPorDia.get(selIso) ?? []) : []

  function cambiarMes(delta: number) {
    setCursor((c) => {
      const d = new Date(c.anio, c.mes + delta, 1)
      return { anio: d.getFullYear(), mes: d.getMonth() }
    })
  }

  async function abrirClase(claseId: string) {
    if (asistenciasPorClase[claseId]) return
    try {
      const as = await getAsistenciasClase(claseId)
      setAsistenciasPorClase((prev) => ({ ...prev, [claseId]: as }))
    } catch (err) { console.error(err) }
  }

  async function marcarAsistencia(claseId: string, usuarioId: string, asistio: boolean) {
    if (!user) return
    setAsistenciasPorClase((prev) => {
      const lista = prev[claseId] ?? []
      const idx = lista.findIndex((a) => a.usuarioId === usuarioId)
      const copia = [...lista]
      if (idx >= 0) {
        copia[idx] = { ...copia[idx], asistio }
      } else {
        copia.push({
          id: `temp-${usuarioId}`, asistenciaId: '', claseId, usuarioId, asistio,
          fecha_registro: Date.now(), registradoPor: user.uid, creadoEn: Date.now(),
        })
      }
      return { ...prev, [claseId]: copia }
    })

    // Sin señal: ni lo intentamos por red — se queda en cola y se
    // sincroniza solo cuando vuelva la conexión (ver PendienteSync).
    if (!navigator.onLine) {
      encolarAsistencia({ claseId, usuarioId, asistio, profesorId: user.uid })
      return
    }

    try {
      await registrarAsistencia(claseId, usuarioId, asistio, user.uid)
    } catch (err) {
      // Si la red falló a mitad de camino, no se descarta: se encola
      // igual que si hubiéramos detectado el offline de antemano.
      if (!navigator.onLine) {
        encolarAsistencia({ claseId, usuarioId, asistio, profesorId: user.uid })
        return
      }
      console.error(err)
      // Error real (no de conectividad): revertir releyendo Firestore.
      getAsistenciasClase(claseId)
        .then((as) => setAsistenciasPorClase((prev) => ({ ...prev, [claseId]: as })))
        .catch(() => {})
    }
  }

  async function guardarPlanClase(claseId: string, bloques: string[]) {
    await updateClasePlan(claseId, bloques)
    setClases((prev) => prev.map((c) => (c.id === claseId ? { ...c, plan: bloques } : c)))
  }

  async function finalizarClase(claseId: string, observaciones: string) {
    if (!user) return
    await updateObservacionesClase(claseId, observaciones, user.uid)
    setClases((prev) => prev.map((c) => (
      c.id === claseId ? { ...c, estado: 'finalizada', observaciones_profesor: observaciones } : c
    )))
  }

  const labelDiaSel = selIso
    ? new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
        .format(parseIso(selIso))
    : ''

  if (!mounted || cargando) {
    return <div className="h-[520px] rounded-[2rem] bg-white/[0.03] border border-white/5 animate-pulse flex items-center justify-center"><Spinner /></div>
  }

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      {/* ── Calendario ── */}
      <div className="lg:col-span-7">
        <Card padding="none" className="overflow-hidden">
          {/* Cabecera de mes */}
          <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/10 bg-white/[0.02]">
            <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
              {MESES[cursor.mes]} <span className="text-[var(--color-on-surface-variant)]/50">{cursor.anio}</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => cambiarMes(-1)}
                aria-label="Mes anterior"
                className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <button
                onClick={() => cambiarMes(1)}
                aria-label="Mes siguiente"
                className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 border-b border-white/5">
            {DIAS_CORTOS.map((d) => (
              <div key={d} className="py-3 text-center label-caps text-[9px] text-[var(--color-on-surface-variant)]/40">
                {d}
              </div>
            ))}
          </div>

          {/* Semanas */}
          <div className="divide-y divide-white/5">
            {semanas.map((semana, i) => (
              <div key={i} className="grid grid-cols-7 divide-x divide-white/5">
                {semana.map((celda) => {
                  if (!celda.fecha) {
                    return <div key={celda.iso} className="min-h-[74px] md:min-h-[92px] bg-white/[0.01]" />
                  }
                  const esHoy = celda.iso === hoyIso
                  const esSel = celda.iso === selIso
                  const tiene = celda.clases.length > 0
                  return (
                    <button
                      key={celda.iso}
                      onClick={() => setSelIso(celda.iso)}
                      className={`min-h-[74px] md:min-h-[92px] p-1.5 md:p-2 flex flex-col items-stretch text-left transition-colors duration-150 ${
                        esSel ? 'bg-[rgba(230,255,0,0.08)]' : tiene ? 'hover:bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <span className={`text-[11px] md:text-xs font-black mb-1 w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
                        esHoy
                          ? 'bg-[var(--color-primary-fixed)] text-black'
                          : esSel ? 'text-[var(--color-primary-fixed)]' : 'text-white/70'
                      }`}>
                        {celda.fecha.getDate()}
                      </span>
                      {/* Chips de horas (desktop) / puntos (móvil) */}
                      <span className="hidden sm:flex flex-col gap-1">
                        {celda.clases.slice(0, 2).map((c) => (
                          <span
                            key={c.id}
                            className="label-caps text-[8px] px-1.5 py-0.5 rounded truncate bg-white/8 text-[var(--color-on-surface-variant)]/80"
                          >
                            {horaAmPm(c.fecha_hora_inicio).hora}
                          </span>
                        ))}
                        {celda.clases.length > 2 && (
                          <span className="label-caps text-[8px] text-[var(--color-on-surface-variant)]/40 px-1.5">
                            +{celda.clases.length - 2}
                          </span>
                        )}
                      </span>
                      {tiene && (
                        <span className="flex sm:hidden gap-1 mt-auto">
                          {celda.clases.slice(0, 4).map((c) => (
                            <span key={c.id} className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-fixed)]" />
                          ))}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Detalle del día seleccionado ── */}
      <div className="lg:col-span-5">
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">event</span>
            <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight capitalize">
              {labelDiaSel || 'Selecciona un día'}
            </h3>
          </div>

          {clasesSel.length === 0 ? (
            <Card className="text-center py-12">
              <span className="material-symbols-outlined text-white/15 text-4xl mb-3 block">event_busy</span>
              <p className="text-sm text-[var(--color-on-surface-variant)]/60">No tienes clases este día.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {clasesSel.map((clase) => (
                <ClaseCard
                  key={clase.id}
                  clase={clase}
                  alumnosMap={alumnosMap}
                  asistencias={asistenciasPorClase[clase.id] ?? null}
                  mensajes={mensajes}
                  onAbrir={() => abrirClase(clase.id)}
                  onEnviarMensaje={enviarMensaje}
                  onGuardarPlan={(bloques) => guardarPlanClase(clase.id, bloques)}
                  onMarcarAsistencia={(uid, asistio) => marcarAsistencia(clase.id, uid, asistio)}
                  onFinalizar={(observaciones) => finalizarClase(clase.id, observaciones)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de una clase: plan + asistencia ──
function ClaseCard({
  clase, alumnosMap, asistencias, mensajes, onAbrir, onEnviarMensaje, onGuardarPlan, onMarcarAsistencia, onFinalizar,
}: {
  clase: Clase
  alumnosMap: Map<string, Usuario>
  asistencias: Asistencia[] | null
  mensajes: Mensaje[]
  onAbrir: () => void
  onEnviarMensaje: (canalId: string, texto: string) => void
  onGuardarPlan: (bloques: string[]) => Promise<void>
  onMarcarAsistencia: (usuarioId: string, asistio: boolean) => void
  onFinalizar: (observaciones: string) => Promise<void>
}) {
  const [abierta, setAbierta] = useState(false)
  const [editandoPlan, setEditandoPlan] = useState(false)
  const [guardandoPlan, setGuardandoPlan] = useState(false)
  const [chatCon, setChatCon] = useState<string | null>(null)
  const [bloquesText, setBloquesText] = useState((clase.plan ?? []).join('\n'))
  const [observaciones, setObservaciones] = useState(clase.observaciones_profesor ?? '')
  const [finalizando, setFinalizando] = useState(false)

  const { hora, ampm } = horaAmPm(clase.fecha_hora_inicio)
  const alumnos = clase.estudiantes_inscritos
    .map((uid) => alumnosMap.get(uid))
    .filter((u): u is Usuario => !!u)

  const tienePlan = (clase.plan ?? []).length > 0
  const asistenciaTomada = (asistencias?.length ?? 0) > 0
  const finalizada = clase.estado === 'finalizada'

  async function guardarPlan() {
    const bloques = bloquesText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (bloques.length === 0) return
    setGuardandoPlan(true)
    try {
      await onGuardarPlan(bloques)
      setEditandoPlan(false)
    } catch (err) {
      console.error(err)
    } finally {
      setGuardandoPlan(false)
    }
  }

  async function finalizar() {
    setFinalizando(true)
    try {
      await onFinalizar(observaciones)
    } catch (err) {
      console.error(err)
    } finally {
      setFinalizando(false)
    }
  }

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Cabecera de la clase */}
      <button
        onClick={() => { setAbierta((v) => !v); if (!abierta) onAbrir() }}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex flex-col items-center justify-center w-14 shrink-0">
          <span className="font-display text-lg font-black text-[var(--color-primary-fixed)] leading-none">{hora}</span>
          <span className="label-caps text-[8px] text-[var(--color-on-surface-variant)]/50 mt-0.5">{ampm}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={ESTADO_BADGE[clase.estado]}>{ESTADO_LABEL[clase.estado]}</Badge>
          </div>
          <p className="font-display text-sm font-extrabold text-white uppercase tracking-tight truncate">{clase.nombre_clase}</p>
          <p className="text-[11px] text-[var(--color-on-surface-variant)]/60 mt-0.5 truncate">{clase.sede} · {clase.estudiantes_inscritos.length} alumnos</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`material-symbols-outlined text-[16px] ${tienePlan ? 'text-[var(--color-success-emerald)]' : 'text-white/20'}`} title={tienePlan ? 'Plan cargado' : 'Sin plan'}>
            {tienePlan ? 'description' : 'note_add'}
          </span>
          <span className={`material-symbols-outlined text-[16px] ${asistenciaTomada ? 'text-[var(--color-success-emerald)]' : 'text-white/20'}`} title={asistenciaTomada ? 'Asistencia tomada' : 'Sin asistencia'}>
            {asistenciaTomada ? 'how_to_reg' : 'checklist'}
          </span>
        </div>
        <span className={`material-symbols-outlined text-white/40 transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {/* Cuerpo expandible */}
      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="p-5 space-y-6">
              {/* ── Plan de clase ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="label-caps text-[10px] text-[var(--color-primary-fixed)]">Plan de clase</h4>
                  {tienePlan && !editandoPlan && (
                    <button onClick={() => setEditandoPlan(true)} className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/60 hover:text-white transition-colors">
                      Editar
                    </button>
                  )}
                </div>

                {tienePlan && !editandoPlan ? (
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <ul className="space-y-2">
                      {(clase.plan ?? []).map((b, i) => (
                        <li key={i} className="flex items-baseline gap-3">
                          <span className="text-[10px] font-black text-[rgba(230,255,0,0.5)]">{String(i + 1).padStart(2, '0')}</span>
                          <span className="text-[13px] text-[var(--color-on-surface)]/80">{b}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="label-caps text-[8px] text-[var(--color-success-emerald)] mt-3 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">visibility</span>
                      Visible para tus alumnos
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!tienePlan && !editandoPlan && (
                      <button
                        onClick={() => setEditandoPlan(true)}
                        className="w-full border-2 border-dashed border-white/10 rounded-2xl p-6 text-center hover:border-[rgba(230,255,0,0.4)] hover:bg-white/[0.03] transition-colors group"
                      >
                        <span className="material-symbols-outlined text-white/20 text-3xl block mb-2 group-hover:text-[var(--color-primary-fixed)] transition-colors">note_add</span>
                        <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60">Subir plan de clase</span>
                      </button>
                    )}
                    {editandoPlan && (
                      <div className="space-y-3">
                        <textarea
                          value={bloquesText}
                          onChange={(e) => setBloquesText(e.target.value)}
                          rows={5}
                          placeholder={'Un paso por línea:\nCalentamiento: 400 m\n8 × 100 m al 80 %\nVuelta a la calma: 200 m'}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors resize-none"
                        />
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditandoPlan(false)}>Cancelar</Button>
                          <Button size="sm" loading={guardandoPlan} onClick={guardarPlan}>Guardar plan</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Asistencia ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="label-caps text-[10px] text-[var(--color-primary-fixed)]">Registrar asistencia</h4>
                  <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">
                    {asistencias?.filter((a) => a.asistio).length ?? 0} / {alumnos.length}
                  </span>
                </div>
                {asistencias === null ? (
                  <div className="flex justify-center py-6"><Spinner size="sm" /></div>
                ) : alumnos.length === 0 ? (
                  <p className="text-sm text-[var(--color-on-surface-variant)]/50">No hay alumnos inscritos.</p>
                ) : (
                  <div className="space-y-2">
                    {alumnos.map((a) => {
                      const presente = asistencias.find((x) => x.usuarioId === a.uid)?.asistio ?? false
                      return (
                        <button
                          key={a.uid}
                          onClick={() => onMarcarAsistencia(a.uid, !presente)}
                          className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                            presente ? 'border-[rgba(230,255,0,0.35)] bg-[rgba(230,255,0,0.05)]' : 'border-white/5 bg-white/[0.02]'
                          }`}
                        >
                          <span className="text-[13px] font-bold text-white truncate">{displayName(a)}</span>
                          <span className={`material-symbols-outlined text-[20px] ${presente ? 'text-[var(--color-primary-fixed)]' : 'text-white/20'}`}>
                            {presente ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Observaciones + finalizar clase ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="label-caps text-[10px] text-[var(--color-primary-fixed)]">Observaciones</h4>
                  {finalizada && <Badge variant="success">Finalizada</Badge>}
                </div>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Escribe tus observaciones de la clase..."
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors resize-none"
                />
                <div className="flex justify-end mt-3">
                  <Button size="sm" loading={finalizando} onClick={finalizar}>
                    {finalizada ? 'Actualizar observaciones' : 'Guardar y finalizar clase'}
                  </Button>
                </div>
              </div>

              {/* ── Mensajes: muro de la clase + privados (demo, sin backend real) ── */}
              <div>
                <h4 className="label-caps text-[10px] text-[var(--color-primary-fixed)] mb-3">Mensajes</h4>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  <button
                    onClick={() => setChatCon(null)}
                    aria-pressed={chatCon === null}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full label-caps text-[9px] transition-colors ${
                      chatCon === null
                        ? 'bg-[var(--color-primary-fixed)] text-black'
                        : 'bg-white/5 text-[var(--color-on-surface-variant)]/60 hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">forum</span>
                    Muro
                  </button>
                  {alumnos.map((a) => (
                    <button
                      key={a.uid}
                      onClick={() => setChatCon(a.uid)}
                      aria-pressed={chatCon === a.uid}
                      className={`px-3 py-1.5 rounded-full label-caps text-[9px] transition-colors ${
                        chatCon === a.uid
                          ? 'bg-[var(--color-primary-fixed)] text-black'
                          : 'bg-white/5 text-[var(--color-on-surface-variant)]/60 hover:text-white'
                      }`}
                    >
                      {a.nombres}
                    </button>
                  ))}
                </div>

                {(() => {
                  const canalId = chatCon === null
                    ? canalGrupo(grupoDeClase(clase))
                    : canalPrivado(chatCon, COACH_ID)
                  const conQuien = chatCon === null
                    ? null
                    : alumnos.find((a) => a.uid === chatCon)?.nombres
                  return (
                    <Conversacion
                      mensajes={delCanal(mensajes, canalId)}
                      yoId={COACH_ID}
                      alto="max-h-[240px]"
                      onEnviar={(texto) => onEnviarMensaje(canalId, texto)}
                      placeholder={chatCon === null ? 'Escribe a toda la clase…' : `Escríbele a ${conQuien}…`}
                      vacio={chatCon === null ? 'Aún nadie ha comentado en esta clase.' : `Empieza la conversación con ${conQuien}.`}
                    />
                  )
                })()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
