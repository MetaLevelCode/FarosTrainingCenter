'use client'

// ============================================================
// FAROS — Semanario del alumno (acción principal del dashboard)
// El alumno arma su semana eligiendo los DÍAS en que entrena (según
// los cupos de su plan). El plan pasa por: solicitud → confirmación
// del club → pago → activo. Hasta estar activo, el acceso es limitado.
// ============================================================

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui'
import {
  SEMANA, HORAS, PASOS, pasosCompletados, cuposDelPlan, diasDelPlan,
  horaDelPlan, reservaProfesor, type Fase,
} from '@/lib/matricula'
import { describirPlan, type PlanAsignado } from '@/lib/planes'

const EASE = [0.22, 1, 0.36, 1] as const

// Estilo del estado de cada día reservado según la fase.
function estadoDia(fase: Fase): { label: string; cls: string } {
  switch (fase) {
    case 'activo': return { label: 'Reservado', cls: 'text-[var(--color-success-emerald)]' }
    case 'por_pagar': return { label: 'Confirmado', cls: 'text-[var(--color-primary-fixed)]' }
    case 'pendiente': return { label: 'En revisión', cls: 'text-amber-400' }
    default: return { label: '', cls: '' }
  }
}

export function Semanario({
  plan, fase, onPagar, onSolicitar,
}: {
  plan: PlanAsignado
  fase: Fase
  onPagar: () => void
  onSolicitar: (dias: number[], hora: string) => void
}) {
  const info = useMemo(() => describirPlan(plan), [plan])
  const cupos = cuposDelPlan(plan)
  const recurrente = reservaProfesor(plan)

  const [editando, setEditando] = useState(false)
  const [dias, setDias] = useState<number[]>(() => diasDelPlan(plan))
  const [hora, setHora] = useState<string>(() => horaDelPlan(plan))
  // Instantánea para restaurar si el alumno cancela la edición.
  const snapshot = useRef<{ dias: number[]; hora: string }>({ dias, hora })

  const activos = dias
  const completo = dias.length === cupos

  function editar() {
    snapshot.current = { dias, hora }
    setEditando(true)
  }

  function cancelar() {
    setDias(snapshot.current.dias)
    setHora(snapshot.current.hora)
    setEditando(false)
  }

  function toggleDia(dow: number) {
    if (!editando) return
    setDias((prev) => {
      if (prev.includes(dow)) return prev.filter((d) => d !== dow)
      if (prev.length >= cupos) return prev  // no exceder los cupos del plan
      return [...prev, dow].sort((a, b) => a - b)
    })
  }

  function enviar() {
    onSolicitar(dias, hora)
    setEditando(false)
  }

  const est = estadoDia(fase)
  const pasos = pasosCompletados(fase)

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[rgba(230,255,0,0.25)] bg-[rgba(230,255,0,0.03)] p-6 md:p-9">
      <div className="absolute -top-24 -right-16 w-80 h-80 bg-[rgba(230,255,0,0.1)] rounded-full blur-[90px] pointer-events-none" aria-hidden="true" />

      <div className="relative z-10">
        {/* ── Encabezado ── */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-2 tracking-[0.25em]">
              Tu semana
            </p>
            <h2 className="font-display text-display-md text-white leading-[0.9] tracking-tighter uppercase">
              {fase === 'activo' ? 'Tus días' : 'Arma tu semana'}
            </h2>
            <p className="text-[var(--color-on-surface-variant)]/70 mt-3 max-w-md text-sm">
              {recurrente
                ? `Elige ${cupos} ${cupos === 1 ? 'día' : 'días'}: tu profesor queda reservado para ti en ese horario.`
                : `Tu plan ${info.titulo} incluye ${cupos} ${cupos === 1 ? 'día' : 'días'} por semana.`}
            </p>
          </div>

          {/* Indicador de progreso del flujo */}
          {fase !== 'vencido' && (
            <div className="flex items-center gap-2 shrink-0">
              {PASOS.map((p, i) => {
                const hecho = i < pasos
                const actual = i === pasos
                return (
                  <div key={p.key} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1.5">
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors duration-300 ${
                          hecho
                            ? 'bg-[var(--color-primary-fixed)] text-black border-transparent'
                            : actual
                              ? 'border-[var(--color-primary-fixed)] text-[var(--color-primary-fixed)]'
                              : 'border-white/10 text-white/30'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {hecho ? 'check' : p.icon}
                        </span>
                      </span>
                      <span className={`label-caps text-[8px] ${hecho || actual ? 'text-white/70' : 'text-white/25'}`}>
                        {p.label}
                      </span>
                    </div>
                    {i < PASOS.length - 1 && (
                      <span className={`w-6 h-px -mt-4 ${i < pasos ? 'bg-[var(--color-primary-fixed)]' : 'bg-white/10'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Semanario: los 6 días ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {SEMANA.map((d) => {
            const sel = activos.includes(d.dow)
            const editable = editando && (sel || dias.length < cupos)
            return (
              <motion.button
                key={d.dow}
                type="button"
                onClick={() => toggleDia(d.dow)}
                disabled={!editando}
                whileTap={editando ? { scale: 0.96 } : undefined}
                transition={{ duration: 0.12, ease: EASE }}
                aria-pressed={sel}
                className={`flex flex-col items-center gap-2 py-5 rounded-2xl border transition-colors duration-200 ${
                  sel
                    ? 'border-[var(--color-primary-fixed)] bg-[rgba(230,255,0,0.1)]'
                    : editando
                      ? editable
                        ? 'border-white/10 bg-white/[0.03] hover:border-[rgba(230,255,0,0.5)] cursor-pointer'
                        : 'border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed'
                      : 'border-white/5 bg-white/[0.02] opacity-50'
                }`}
              >
                <span className={`label-caps text-[10px] ${sel ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/50'}`}>
                  {d.corto}
                </span>
                {sel ? (
                  <>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-primary-fixed)]">
                      {fase === 'activo' ? 'check_circle' : 'schedule'}
                    </span>
                    <span className="font-display text-[11px] font-black text-white">{hora}</span>
                    {!editando && est.label && (
                      <span className={`label-caps text-[8px] ${est.cls}`}>{est.label}</span>
                    )}
                  </>
                ) : (
                  <span className="material-symbols-outlined text-[20px] text-white/15">
                    {editando ? 'add' : 'remove'}
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>

        {/* ── Selector de hora (solo en edición) ── */}
        <AnimatePresence initial={false}>
          {editando && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden mb-6"
            >
              <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mb-3">
                Hora preferida · aplica a los días elegidos
              </p>
              <div className="flex flex-wrap gap-2">
                {HORAS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHora(h)}
                    className={`px-4 py-2 rounded-full label-caps text-[10px] border transition-colors duration-200 ${
                      hora === h
                        ? 'bg-[var(--color-primary-fixed)] text-black border-transparent'
                        : 'border-white/10 text-[var(--color-on-surface-variant)]/70 hover:border-[rgba(230,255,0,0.5)]'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Banner de fase / acciones ── */}
        {editando ? (
          <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="flex-1 text-sm text-[var(--color-on-surface-variant)]/80 text-center sm:text-left">
              {completo
                ? `Elegiste ${cupos} ${cupos === 1 ? 'día' : 'días'}. Envía tu solicitud para que el club confirme con tu profesor.`
                : `Elige ${cupos - dias.length} ${cupos - dias.length === 1 ? 'día más' : 'días más'} para completar tu plan.`}
            </p>
            <div className="flex gap-3 shrink-0 w-full sm:w-auto">
              <Button variant="ghost" size="md" onClick={cancelar}>
                Cancelar
              </Button>
              <Button size="md" disabled={!completo} onClick={enviar}>
                Enviar solicitud
              </Button>
            </div>
          </div>
        ) : (
          <BannerFase
            fase={fase}
            plan={plan}
            recurrente={recurrente}
            onPagar={onPagar}
            onEditar={editar}
          />
        )}
      </div>
    </section>
  )
}

// ── Banner según la fase del plan ──
function BannerFase({
  fase, plan, recurrente, onPagar, onEditar,
}: {
  fase: Fase
  plan: PlanAsignado
  recurrente: boolean
  onPagar: () => void
  onEditar: () => void
}) {
  if (fase === 'pendiente') {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center sm:text-left">
        <span className="material-symbols-outlined text-amber-400 text-4xl shrink-0 animate-pulse">hourglass_top</span>
        <div className="flex-1">
          <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-1">
            Solicitud en revisión
          </h3>
          <p className="text-sm text-[var(--color-on-surface-variant)]/70">
            El club está coordinando con tu profesor la disponibilidad para los días que pediste.
            Te avisaremos cuando puedas pagar y activar tu plan.
          </p>
        </div>
      </div>
    )
  }

  if (fase === 'por_pagar') {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-[rgba(230,255,0,0.35)] bg-[rgba(230,255,0,0.07)] p-6 text-center sm:text-left">
        <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-4xl shrink-0">verified</span>
        <div className="flex-1">
          <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-1">
            ¡Tu plan fue confirmado!
          </h3>
          <p className="text-sm text-[var(--color-on-surface-variant)]/70">
            {recurrente ? 'Tu profesor está disponible en esos días.' : 'Hay cupo en el horario que elegiste.'}{' '}
            Paga para activar tu plan y reservar tu lugar — {info(plan)}.
          </p>
        </div>
        <Button size="lg" onClick={onPagar} className="shrink-0 w-full sm:w-auto">
          Pagar y activar
        </Button>
      </div>
    )
  }

  if (fase === 'vencido') {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] p-6 text-center sm:text-left">
        <span className="material-symbols-outlined text-[var(--color-danger-crimson)] text-4xl shrink-0">lock_clock</span>
        <div className="flex-1">
          <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-1">
            Tu plan está vencido
          </h3>
          <p className="text-sm text-[var(--color-on-surface-variant)]/70">
            Renueva para recuperar tus días y volver a entrenar.
          </p>
        </div>
        <Link href="/dashboard/planes" className="shrink-0 w-full sm:w-auto">
          <Button size="lg" fullWidth>Renovar plan</Button>
        </Link>
      </div>
    )
  }

  // activo
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.06)] p-6 text-center sm:text-left">
      <span className="material-symbols-outlined text-[var(--color-success-emerald)] text-4xl shrink-0">event_available</span>
      <div className="flex-1">
        <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-1">
          Plan activo
        </h3>
        <p className="text-sm text-[var(--color-on-surface-variant)]/70">
          {recurrente
            ? 'Tus días quedaron reservados con tu profesor.'
            : 'Estás inscrito en los días de tu grupo.'}{' '}
          Próximo pago: {plan.proximoPago}.
        </p>
      </div>
      <Button variant="ghost" size="md" onClick={onEditar} className="shrink-0 w-full sm:w-auto">
        Solicitar cambio de días
      </Button>
    </div>
  )
}

function info(plan: PlanAsignado): string {
  const d = describirPlan(plan)
  return d.precioTexto === 'Por confirmar' ? 'tarifa por confirmar' : `${d.precioTexto}/mes`
}
