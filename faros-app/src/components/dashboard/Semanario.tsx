'use client'

// ============================================================
// FAROS — Semanario del alumno (acción principal del dashboard)
// Muestra los días fijos en que el alumno entrena (según su grupo o
// plan) y la fase de su matrícula. Es de solo lectura — el cambio de
// días no tiene flujo propio: para gestionar horario, el alumno usa
// la inscripción por clase en /dashboard/asistencia.
// ============================================================

import Link from 'next/link'
import { Button } from '@/components/ui'
import {
  SEMANA, PASOS, pasosCompletados, type Fase,
} from '@/lib/matricula'

// Estilo del estado de cada día reservado según la fase.
function estadoDia(fase: Fase): { label: string; cls: string } {
  switch (fase) {
    case 'activo': return { label: 'Reservado', cls: 'text-[var(--color-success-emerald)]' }
    case 'pendiente': return { label: 'En revisión', cls: 'text-amber-400' }
    default: return { label: '', cls: '' }
  }
}

export function Semanario({
  fase, cupos, nombrePlan, recurrente = false, proximoPago,
  diasSemana = [],
}: {
  fase: Fase
  /** Sesiones que le quedan por reservar (viene de la suscripción). */
  cupos: number
  /** undefined cuando el estudiante todavía no tiene ninguna suscripción. */
  nombrePlan?: string
  /** true en planes personales: el profesor queda reservado para él. */
  recurrente?: boolean
  proximoPago?: string
  /** Cada día puede tener su propia hora (plan 2x/3x semana con franjas distintas). */
  diasSemana?: { dow: number; hora: string }[]
}) {
  const hayPlan = Boolean(nombrePlan)
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
              {!hayPlan
                ? 'Cuando tengas un plan activo podrás ver aquí los días en que entrenas.'
                : recurrente
                  ? `Tienes ${cupos} ${cupos === 1 ? 'día' : 'días'}: tu profesor queda reservado para ti en ese horario.`
                  : `Tu plan ${nombrePlan} te deja ${cupos} ${cupos === 1 ? 'sesión' : 'sesiones'} por reservar.`}
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

        {/* ── Semanario: los 6 días (solo lectura) ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {SEMANA.map((d) => {
            const infoDia = diasSemana.find((x) => x.dow === d.dow)
            const sel = !!infoDia
            return (
              <div
                key={d.dow}
                className={`flex flex-col items-center gap-2 py-5 rounded-2xl border transition-colors duration-200 ${
                  sel
                    ? 'border-[var(--color-primary-fixed)] bg-[rgba(230,255,0,0.1)]'
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
                    <span className="font-display text-[11px] font-black text-white">{infoDia?.hora}</span>
                    {est.label && (
                      <span className={`label-caps text-[8px] ${est.cls}`}>{est.label}</span>
                    )}
                  </>
                ) : (
                  <span className="material-symbols-outlined text-[20px] text-white/15">remove</span>
                )}
              </div>
            )
          })}
        </div>

        <BannerFase
          fase={fase}
          hayPlan={hayPlan}
          proximoPago={proximoPago}
          recurrente={recurrente}
        />
      </div>
    </section>
  )
}

// ── Banner según la fase del plan ──
function BannerFase({
  fase, hayPlan, proximoPago, recurrente,
}: {
  fase: Fase
  hayPlan: boolean
  proximoPago?: string
  recurrente: boolean
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
            Ya recibimos tu solicitud y tu comprobante de pago. El equipo administrativo lo está
            revisando — te avisaremos apenas quede activo tu plan.
          </p>
        </div>
      </div>
    )
  }

  if (fase === 'vencido') {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] p-6 text-center sm:text-left">
        <span className="material-symbols-outlined text-[var(--color-danger-crimson)] text-4xl shrink-0">lock_clock</span>
        <div className="flex-1">
          <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-1">
            {hayPlan ? 'Tu plan está vencido' : 'Aún no tienes un plan'}
          </h3>
          <p className="text-sm text-[var(--color-on-surface-variant)]/70">
            {hayPlan
              ? 'Renueva para recuperar tus días y volver a entrenar.'
              : 'Solicita un plan para empezar a reservar tus clases.'}
          </p>
        </div>
        <Link href="/dashboard/planes" className="shrink-0 w-full sm:w-auto">
          <Button size="lg" fullWidth>{hayPlan ? 'Renovar plan' : 'Solicitar plan'}</Button>
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
            : 'Estás inscrito en los días de tu grupo.'}
          {proximoPago ? ` Vence: ${proximoPago}.` : ''}
        </p>
      </div>
    </div>
  )
}
