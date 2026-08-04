'use client'

// ============================================================
// FAROS — Calendario del entrenador
// El portal del coach es un gran calendario. Cada día muestra sus
// clases; al abrir una clase, el coach ve o sube el PLAN DE CLASE
// (que verá el alumno) y registra la ASISTENCIA de ese día.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Card, Button, Badge } from '@/components/ui'
import { Conversacion } from '@/components/shared/Conversacion'
import {
  mallaDelMes, clasesDelDia, planSemilla, isoDe, grupoDeClase,
  MESES, DIAS_CORTOS, type Clase, type PlanClase,
} from '@/lib/agenda'
import {
  mensajesSemilla, delCanal, nuevoMensaje, canalGrupo, canalPrivado,
  COACH_ID, COACH_NOMBRE, type Mensaje,
} from '@/lib/mensajes'

const EASE = [0.22, 1, 0.36, 1] as const

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function CalendarioEntrenador() {
  const [mounted, setMounted] = useState(false)
  const [cursor, setCursor] = useState({ anio: 2026, mes: 6 })
  const [selIso, setSelIso] = useState<string | null>(null)
  const [hoyIso, setHoyIso] = useState<string | null>(null)

  // Planes subidos y asistencia registrada (se conectan a Firestore).
  const [planes, setPlanes] = useState<Record<string, PlanClase>>({})
  const [asistencia, setAsistencia] = useState<Record<string, string[]>>({})
  // Los mensajes viven aquí para no perderse al cambiar de día/clase.
  const [mensajes, setMensajes] = useState<Mensaje[]>(() => mensajesSemilla())

  function enviarMensaje(canalId: string, texto: string) {
    setMensajes((prev) => [...prev, nuevoMensaje(canalId, COACH_ID, COACH_NOMBRE, 'entrenador', texto)])
  }

  // Fechas → en cliente para no romper la hidratación.
  useEffect(() => {
    const hoy = new Date()
    setCursor({ anio: hoy.getFullYear(), mes: hoy.getMonth() })
    setSelIso(isoDe(hoy))
    setHoyIso(isoDe(hoy))
    setMounted(true)
  }, [])

  const semanas = useMemo(() => mallaDelMes(cursor.anio, cursor.mes), [cursor])
  const clasesSel = useMemo(
    () => (selIso ? clasesDelDia(parseIso(selIso)) : []),
    [selIso],
  )

  function cambiarMes(delta: number) {
    setCursor((c) => {
      const d = new Date(c.anio, c.mes + delta, 1)
      return { anio: d.getFullYear(), mes: d.getMonth() }
    })
  }

  function guardarPlan(id: string, plan: PlanClase) {
    setPlanes((prev) => ({ ...prev, [id]: plan }))
  }
  function guardarAsistencia(id: string, ids: string[]) {
    setAsistencia((prev) => ({ ...prev, [id]: ids }))
  }

  const labelDiaSel = selIso
    ? new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
        .format(parseIso(selIso))
    : ''

  if (!mounted) {
    return <div className="h-[520px] rounded-[2rem] bg-white/[0.03] border border-white/5 animate-pulse" />
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
                            className={`label-caps text-[8px] px-1.5 py-0.5 rounded truncate ${
                              c.tipo === 'Personal'
                                ? 'bg-[rgba(230,255,0,0.15)] text-[var(--color-primary-fixed)]'
                                : 'bg-white/8 text-[var(--color-on-surface-variant)]/80'
                            }`}
                          >
                            {c.hora}
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
                  plan={planes[clase.id] ?? planSemilla(clase)}
                  presentes={asistencia[clase.id] ?? null}
                  mensajes={mensajes}
                  onEnviarMensaje={enviarMensaje}
                  onGuardarPlan={(p) => guardarPlan(clase.id, p)}
                  onGuardarAsistencia={(ids) => guardarAsistencia(clase.id, ids)}
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
  clase, plan, presentes, mensajes, onEnviarMensaje, onGuardarPlan, onGuardarAsistencia,
}: {
  clase: Clase
  plan: PlanClase | null
  presentes: string[] | null
  mensajes: Mensaje[]
  onEnviarMensaje: (canalId: string, texto: string) => void
  onGuardarPlan: (p: PlanClase) => void
  onGuardarAsistencia: (ids: string[]) => void
}) {
  const [abierta, setAbierta] = useState(false)
  const [editandoPlan, setEditandoPlan] = useState(false)
  // Canal abierto en la sección de mensajes: el muro o un privado.
  const [chatCon, setChatCon] = useState<string | null>(null)
  const [titulo, setTitulo] = useState(plan?.titulo ?? '')
  const [bloquesText, setBloquesText] = useState(plan?.bloques.join('\n') ?? '')

  const [draft, setDraft] = useState<Set<string>>(() => new Set(presentes ?? []))
  const [guardada, setGuardada] = useState(presentes !== null)

  const tienePlan = !!plan
  const asistenciaTomada = presentes !== null

  function togglePresente(id: string) {
    setGuardada(false)
    setDraft((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function guardarPlan() {
    const bloques = bloquesText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!titulo.trim() || bloques.length === 0) return
    onGuardarPlan({ titulo: titulo.trim(), bloques })
    setEditandoPlan(false)
  }

  function guardarAsistencia() {
    onGuardarAsistencia([...draft])
    setGuardada(true)
  }

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Cabecera de la clase */}
      <button
        onClick={() => setAbierta((v) => !v)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex flex-col items-center justify-center w-14 shrink-0">
          <span className="font-display text-lg font-black text-[var(--color-primary-fixed)] leading-none">
            {clase.hora.replace(/ (AM|PM)/, '')}
          </span>
          <span className="label-caps text-[8px] text-[var(--color-on-surface-variant)]/50 mt-0.5">
            {clase.hora.includes('AM') ? 'AM' : 'PM'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={clase.tipo === 'Personal' ? 'primary' : 'default'}>{clase.tipo}</Badge>
          </div>
          <p className="font-display text-sm font-extrabold text-white uppercase tracking-tight truncate">{clase.titulo}</p>
          <p className="text-[11px] text-[var(--color-on-surface-variant)]/60 mt-0.5">{clase.sede} · {clase.alumnos.length} alumnos</p>
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
                    <p className="font-display text-sm font-extrabold text-white uppercase tracking-tight mb-3">{plan!.titulo}</p>
                    <ul className="space-y-2">
                      {plan!.bloques.map((b, i) => (
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
                        <input
                          value={titulo}
                          onChange={(e) => setTitulo(e.target.value)}
                          placeholder="Título del plan (ej. Técnica y resistencia)"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors"
                        />
                        <textarea
                          value={bloquesText}
                          onChange={(e) => setBloquesText(e.target.value)}
                          rows={5}
                          placeholder={'Un paso por línea:\nCalentamiento: 400 m\n8 × 100 m al 80 %\nVuelta a la calma: 200 m'}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors resize-none"
                        />
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditandoPlan(false)}>Cancelar</Button>
                          <Button size="sm" onClick={guardarPlan}>Guardar plan</Button>
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
                    {draft.size} / {clase.alumnos.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {clase.alumnos.map((a) => {
                    const presente = draft.has(a.id)
                    return (
                      <button
                        key={a.id}
                        onClick={() => togglePresente(a.id)}
                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                          presente ? 'border-[rgba(230,255,0,0.35)] bg-[rgba(230,255,0,0.05)]' : 'border-white/5 bg-white/[0.02]'
                        }`}
                      >
                        <span className="text-[13px] font-bold text-white truncate">{a.nombre}</span>
                        <span className={`material-symbols-outlined text-[20px] ${presente ? 'text-[var(--color-primary-fixed)]' : 'text-white/20'}`}>
                          {presente ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <Button size="sm" fullWidth className="mt-4" onClick={guardarAsistencia} disabled={guardada}>
                  {guardada ? 'Asistencia guardada ✓' : 'Guardar asistencia'}
                </Button>
              </div>

              {/* ── Mensajes: muro de la clase + privados ── */}
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
                  {clase.alumnos.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setChatCon(a.id)}
                      aria-pressed={chatCon === a.id}
                      className={`px-3 py-1.5 rounded-full label-caps text-[9px] transition-colors ${
                        chatCon === a.id
                          ? 'bg-[var(--color-primary-fixed)] text-black'
                          : 'bg-white/5 text-[var(--color-on-surface-variant)]/60 hover:text-white'
                      }`}
                    >
                      {a.nombre.split(' ')[0]}
                    </button>
                  ))}
                </div>

                {(() => {
                  const canalId = chatCon === null
                    ? canalGrupo(grupoDeClase(clase))
                    : canalPrivado(chatCon, COACH_ID)
                  const conQuien = chatCon === null
                    ? null
                    : clase.alumnos.find((a) => a.id === chatCon)?.nombre.split(' ')[0]
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
