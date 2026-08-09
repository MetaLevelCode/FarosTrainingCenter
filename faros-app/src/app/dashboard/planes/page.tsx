'use client'

// ============================================================
// FAROS — Alumno · Arma tu plan
// Flujo guiado (wizard) de temática acuática que culmina con el
// plan personalizado deseado. El precio no es plano: se calcula
// en vivo según modalidad, frecuencia, personas y sede.
// Cada opción se EXPANDE al seleccionarla para revelar detalle
// extra. Al confirmar, la solicitud viaja a administración.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useAuth } from '@/contexts/AuthContext'
import { FarosWordmark, Spinner, Button } from '@/components/ui'
import { WaterBackground } from '@/components/shared/WaterBackground'
import {
  TIPOS, GRUPOS, GRUPO_POR_SESION, PERSONALES, CONJUNTOS, FRECUENCIAS,
  SELECCION_INICIAL, calcularPrecio, resumenPlan, fmtCOP,
  type SeleccionPlan, type TipoPlan,
} from '@/lib/planes'

const EASE = [0.22, 1, 0.36, 1] as const

// Secuencia de pasos según el tipo de plan elegido.
type StepKey = 'tipo' | 'grupo' | 'personal' | 'conjunto' | 'frecuencia' | 'ninos' | 'resumen'

function stepsFor(tipo: TipoPlan | null): StepKey[] {
  switch (tipo) {
    case 'grupal': return ['tipo', 'grupo', 'frecuencia', 'resumen']
    case 'personal': return ['tipo', 'personal', 'frecuencia', 'resumen']
    case 'conjunto': return ['tipo', 'conjunto', 'frecuencia', 'resumen']
    case 'vacaciones': return ['tipo', 'ninos', 'resumen']
    default: return ['tipo', 'grupo', 'frecuencia', 'resumen']
  }
}

const STEP_TITULO: Record<StepKey, string> = {
  tipo: '¿Qué tipo de plan buscas?',
  grupo: 'Elige tu grupo y sede',
  personal: 'Elige tu modalidad',
  conjunto: 'Elige tu combinación',
  frecuencia: '¿Con qué frecuencia entrenas?',
  ninos: '¿Cuántos niños?',
  resumen: 'Tu plan a la medida',
}

// ── Lista de beneficios revelada al expandir ──
function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-4">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-3 text-sm text-[var(--color-on-surface-variant)]/85">
          <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-[17px] mt-0.5 shrink-0">check_circle</span>
          {t}
        </li>
      ))}
    </ul>
  )
}

// ── Tarjeta de opción: se expande al seleccionarse (grid-rows 0fr→1fr) ──
function ChoiceCard({ selected, onClick, icon, title, desc, meta, expand }: {
  selected: boolean; onClick: () => void; icon?: string; title: string
  desc?: string; meta?: React.ReactNode; expand?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full text-left rounded-3xl border overflow-hidden transition-[border-color,background-color,box-shadow,transform] duration-300 active:scale-[0.99] ${
        selected
          ? 'border-[var(--color-primary-fixed)] bg-[rgba(230,255,0,0.05)] shadow-[0_0_36px_rgba(230,255,0,0.1)]'
          : 'border-white/8 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-start gap-5 p-7 md:p-8">
        {icon && (
          <span className={`material-symbols-outlined text-[26px] shrink-0 mt-0.5 transition-colors duration-300 ${
            selected ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/70'
          }`}>{icon}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-extrabold text-white uppercase tracking-tight">{title}</p>
          {desc && <p className="text-sm text-[var(--color-on-surface-variant)]/60 mt-3 leading-relaxed">{desc}</p>}
          {meta}
        </div>
        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-300 ${
          selected ? 'border-[var(--color-primary-fixed)] bg-[var(--color-primary-fixed)]' : 'border-white/20'
        }`}>
          {selected && <span className="material-symbols-outlined text-black text-[16px]">check</span>}
        </span>
      </div>

      {expand && selected && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="px-7 md:px-8 pb-8"
        >
          <div className="border-t border-white/8 pt-6 md:pl-[46px]">
            {expand}
          </div>
        </motion.div>
      )}
    </button>
  )
}

// ── Stepper numérico (± personas / niños) ──
function Contador({ value, min, max, onChange, sufijo }: {
  value: number; min: number; max: number; onChange: (v: number) => void; sufijo: string
}) {
  return (
    <div className="flex items-center gap-8 justify-center">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Restar"
        className="w-14 h-14 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-white active:scale-[0.94] transition-transform duration-150 disabled:opacity-30"
      >
        <span className="material-symbols-outlined">remove</span>
      </button>
      <div className="text-center min-w-[130px]">
        <span className="font-display text-6xl font-black text-[var(--color-primary-fixed)] leading-none">{value}</span>
        <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-3">{sufijo}</p>
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Sumar"
        className="w-14 h-14 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-white active:scale-[0.94] transition-transform duration-150 disabled:opacity-30"
      >
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  )
}

// Fila de dato revelada (para grupos)
function DatoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/60 text-[18px] shrink-0">{icon}</span>
      <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 w-16 shrink-0">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  )
}

const PENDIENTE_KEY = 'faros-plan-pendiente'

export default function PlanesFlowPage() {
  // Abierto a invitados: cualquiera puede armar su plan; al final se
  // pide cuenta/sesión sólo para enviarlo (sin perder el progreso).
  const { user, loading } = useAuth()
  const [sel, setSel] = useState<SeleccionPlan>(SELECCION_INICIAL)
  const [stepIdx, setStepIdx] = useState(0)
  const [dir, setDir] = useState(1)
  const [solicitado, setSolicitado] = useState(false)
  const [solicitando, setSolicitando] = useState(false)
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null)
  const [necesitaCuenta, setNecesitaCuenta] = useState(false)

  // Restaura el plan que un invitado dejó a medias antes de iniciar sesión.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PENDIENTE_KEY)
      if (!raw) return
      localStorage.removeItem(PENDIENTE_KEY)
      const saved = JSON.parse(raw) as SeleccionPlan
      setSel(saved)
      setStepIdx(stepsFor(saved.tipo).length - 1) // directo al resumen
    } catch {}
  }, [])

  const steps = useMemo(() => stepsFor(sel.tipo), [sel.tipo])
  const stepKey = steps[Math.min(stepIdx, steps.length - 1)]
  const precio = useMemo(() => calcularPrecio(sel), [sel])
  const resumen = useMemo(() => resumenPlan(sel), [sel])

  const subPersonal = PERSONALES.find((p) => p.id === sel.personalId)
  const pidePersonas = sel.tipo === 'personal' && subPersonal?.porPersona

  const puedeAvanzar = (() => {
    switch (stepKey) {
      case 'tipo': return !!sel.tipo
      case 'grupo': return !!sel.grupoId
      case 'personal': return !!sel.personalId
      case 'conjunto': return !!sel.conjuntoId
      default: return true
    }
  })()

  function goNext() {
    if (stepIdx < steps.length - 1) { setDir(1); setStepIdx((s) => s + 1) }
  }
  function goBack() {
    if (stepIdx > 0) { setDir(-1); setStepIdx((s) => s - 1) }
  }
  function pickTipo(tipo: TipoPlan) {
    setSel({ ...SELECCION_INICIAL, tipo, week: tipo === 'conjunto' ? 1 : 2 })
  }

  async function solicitar() {
    if (!user) {
      try { localStorage.setItem(PENDIENTE_KEY, JSON.stringify(sel)) } catch {}
      setNecesitaCuenta(true)
      return
    }

    setSolicitando(true)
    setErrorSolicitud(null)
    try {
      // Importamos auth de Firebase para obtener el ID token del usuario actual
      const { getAuth } = await import('firebase/auth')
      const idToken = await getAuth().currentUser?.getIdToken()
      if (!idToken) throw new Error('No autenticado')

      const res = await fetch('/api/transacciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ seleccion: sel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar la solicitud')

      setSolicitado(true)
    } catch (err: any) {
      setErrorSolicitud(err.message ?? 'No se pudo enviar la solicitud. Intenta de nuevo.')
    } finally {
      setSolicitando(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#050505' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  const totalSteps = steps.length
  const progress = ((stepIdx + 1) / totalSteps) * 100

  return (
    <div className="relative min-h-dvh flex flex-col">
      <WaterBackground />

      {/* ── Top bar ── */}
      <header className="relative z-10 h-20 px-5 md:px-10 flex items-center justify-between shrink-0">
        <FarosWordmark size="sm" />
        <Link
          href="/dashboard"
          aria-label="Salir del flujo"
          className="w-11 h-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-[var(--color-on-surface-variant)] hover:text-white hover:border-white/25 transition-colors duration-200"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </Link>
      </header>

      {/* ── Progreso ── */}
      <div className="relative z-10 px-5 md:px-10 pt-2 pb-2 shrink-0">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-2.5">
            <span className="label-caps text-[10px] text-[var(--color-primary-fixed)]">Paso {stepIdx + 1} de {totalSteps}</span>
            <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">Arma tu plan</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[var(--color-primary-fixed)] shadow-[0_0_12px_rgba(230,255,0,0.5)]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: EASE }}
            />
          </div>
        </div>
      </div>

      {/* ── Contenido del paso (centrado verticalmente) ── */}
      <main className="relative z-10 flex-1 overflow-y-auto flex flex-col px-5 md:px-10">
        <div className="w-full max-w-xl mx-auto my-auto pt-4 pb-10">
          <motion.div
            key={stepKey}
            initial={{ opacity: 0, x: dir * 36 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <h1 className="font-display text-[clamp(1.75rem,5vw,2.5rem)] font-black text-white uppercase tracking-tighter leading-tight mb-14">
              {STEP_TITULO[stepKey]}
            </h1>

            {/* PASO: TIPO */}
            {stepKey === 'tipo' && (
              <div className="space-y-6">
                {TIPOS.map((t) => (
                  <ChoiceCard
                    key={t.id}
                    selected={sel.tipo === t.id}
                    onClick={() => pickTipo(t.id)}
                    icon={t.icon}
                    title={t.nombre}
                    desc={t.desc}
                    expand={<Bullets items={t.detalle} />}
                  />
                ))}
              </div>
            )}

            {/* PASO: GRUPO */}
            {stepKey === 'grupo' && (
              <div className="space-y-6">
                {GRUPOS.map((g) => (
                  <ChoiceCard
                    key={g.id}
                    selected={sel.grupoId === g.id}
                    onClick={() => setSel((s) => ({ ...s, grupoId: g.id }))}
                    icon="location_on"
                    title={g.nombre}
                    meta={
                      <div className="flex flex-wrap gap-2 mt-3">
                        {g.horarios.map((h) => (
                          <span key={h} className="label-caps text-[9px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[var(--color-on-surface-variant)]/70">
                            {h}
                          </span>
                        ))}
                        {!g.disponible && (
                          <span className="label-caps text-[9px] px-2.5 py-1 rounded-full bg-[rgba(239,68,68,0.12)] text-[var(--color-danger-crimson)]">
                            Cupos por confirmar
                          </span>
                        )}
                      </div>
                    }
                    expand={
                      <div className="space-y-4">
                        <DatoRow icon="stairs" label="Nivel" value={g.nivel} />
                        <DatoRow icon="event_seat" label="Cupos" value={g.cupos} />
                        <DatoRow icon="sports" label="Coach" value={g.coach} />
                      </div>
                    }
                  />
                ))}
              </div>
            )}

            {/* PASO: PERSONAL */}
            {stepKey === 'personal' && (
              <div className="space-y-6">
                {PERSONALES.map((p) => (
                  <ChoiceCard
                    key={p.id}
                    selected={sel.personalId === p.id}
                    onClick={() => setSel((s) => ({ ...s, personalId: p.id, personas: p.personasMin }))}
                    icon={p.porPersona ? 'group' : 'person'}
                    title={p.nombre}
                    desc={p.desc}
                    expand={<Bullets items={p.incluye} />}
                  />
                ))}
              </div>
            )}

            {/* PASO: CONJUNTO */}
            {stepKey === 'conjunto' && (
              <div className="space-y-6">
                {CONJUNTOS.map((c) => (
                  <ChoiceCard
                    key={c.id}
                    selected={sel.conjuntoId === c.id}
                    onClick={() => setSel((s) => ({ ...s, conjuntoId: c.id }))}
                    icon="join_inner"
                    title={c.nombre}
                    desc={c.desc}
                    expand={<Bullets items={c.incluye} />}
                  />
                ))}
              </div>
            )}

            {/* PASO: FRECUENCIA (+ personas si aplica) */}
            {stepKey === 'frecuencia' && (
              <div className="space-y-6">
                {FRECUENCIAS
                  .filter((f) => sel.tipo !== 'conjunto' || f.week <= 2)
                  .map((f) => {
                    const p = calcularPrecio({ ...sel, week: f.week })
                    return (
                      <ChoiceCard
                        key={f.week}
                        selected={sel.week === f.week}
                        onClick={() => setSel((s) => ({ ...s, week: f.week }))}
                        icon="calendar_month"
                        title={f.label}
                        desc={sel.tipo === 'grupal'
                          ? `${fmtCOP(GRUPO_POR_SESION[f.week])} por sesión`
                          : `${f.mes} sesiones al mes`}
                        expand={
                          <div className="flex items-center justify-between">
                            <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">
                              {pidePersonas ? `Total mensual · ${sel.personas} pers.` : 'Total mensual estimado'}
                            </span>
                            <span className="font-display text-xl font-black text-[var(--color-primary-fixed)]">
                              {p.disponible ? fmtCOP(p.total) : 'Por confirmar'}
                            </span>
                          </div>
                        }
                      />
                    )
                  })}

                {pidePersonas && subPersonal && (
                  <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-7 mt-1">
                    <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mb-6 text-center">
                      Personas ({subPersonal.personasMin}–{subPersonal.personasMax})
                    </p>
                    <Contador
                      value={sel.personas}
                      min={subPersonal.personasMin}
                      max={subPersonal.personasMax}
                      onChange={(v) => setSel((s) => ({ ...s, personas: v }))}
                      sufijo="personas"
                    />
                  </div>
                )}
              </div>
            )}

            {/* PASO: NIÑOS (vacaciones) */}
            {stepKey === 'ninos' && (
              <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-10">
                <Contador
                  value={sel.ninos}
                  min={1}
                  max={10}
                  onChange={(v) => setSel((s) => ({ ...s, ninos: v }))}
                  sufijo={sel.ninos === 1 ? 'niño inscrito' : 'niños inscritos'}
                />
              </div>
            )}

            {/* PASO: RESUMEN */}
            {stepKey === 'resumen' && !solicitado && !necesitaCuenta && (
              <div className="rounded-[2rem] liquid-glass p-8 md:p-10">
                <div className="relative z-10">
                  <span className="label-caps text-[10px] text-[var(--color-primary-fixed)]">{resumen.subtitulo}</span>
                  <h2 className="font-display text-3xl font-black text-white uppercase tracking-tighter mt-2.5 mb-7">
                    {resumen.titulo}
                  </h2>

                  {resumen.horarios.length > 0 && (
                    <div className="flex flex-wrap gap-2.5 mb-8">
                      {resumen.horarios.map((h) => (
                        <span key={h} className="label-caps text-[9px] px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[var(--color-on-surface-variant)]/80">
                          {h}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4 mb-9">
                    <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                      <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">Frecuencia</span>
                      <span className="text-sm text-white text-right">{precio.detalleFrecuencia}</span>
                    </div>
                    {precio.porPersona != null && (
                      <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                        <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">
                          {sel.tipo === 'vacaciones' ? 'Por niño' : 'Por persona'} · {precio.personas}
                        </span>
                        <span className="text-sm text-white">{fmtCOP(precio.porPersona)}</span>
                      </div>
                    )}
                  </div>

                  {precio.disponible ? (
                    <div className="flex items-end justify-between mb-9">
                      <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">
                        {sel.tipo === 'vacaciones' ? 'Total programa' : 'Total mensual'}
                      </span>
                      <motion.span
                        key={precio.total}
                        initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="font-display text-4xl font-black text-[var(--color-primary-fixed)] leading-none drop-shadow-[0_0_15px_rgba(230,255,0,0.3)]"
                      >
                        {fmtCOP(precio.total)}
                      </motion.span>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-9 text-center">
                      <p className="text-sm text-[var(--color-on-surface-variant)]/70">
                        Esta opción tiene <span className="text-white font-bold">tarifa por confirmar</span>. Envía la
                        solicitud y administración te contactará con el valor.
                      </p>
                    </div>
                  )}

                  <Button fullWidth size="lg" onClick={solicitar} loading={solicitando} disabled={solicitando}>
                    {user ? 'Solicitar este plan' : 'Continuar'}
                  </Button>
                  {errorSolicitud && (
                    <p className="text-xs text-[var(--color-danger-crimson)] text-center mt-3">{errorSolicitud}</p>
                  )}
                  <p className="text-[11px] text-[var(--color-on-surface-variant)]/40 text-center mt-5">
                    {user
                      ? 'Tu solicitud pasa a administración para aprobación del pago.'
                      : 'Necesitas una cuenta para enviar tu solicitud. No perderás tu plan.'}
                  </p>
                </div>
              </div>
            )}

            {/* PASO: INVITADO — crear cuenta / iniciar sesión ── */}
            {stepKey === 'resumen' && necesitaCuenta && (
              <div className="rounded-[2rem] liquid-glass p-8 md:p-10 text-center">
                <div className="relative z-10 flex flex-col items-center">
                  <span className="w-16 h-16 rounded-full bg-[rgba(230,255,0,0.12)] border border-[rgba(230,255,0,0.3)] flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-[30px]">person_add</span>
                  </span>
                  <h2 className="font-display text-2xl font-black text-white uppercase tracking-tight mb-3">
                    Un último paso
                  </h2>
                  <p className="text-sm text-[var(--color-on-surface-variant)]/70 max-w-sm mb-2 leading-relaxed">
                    Tu plan <span className="text-white font-bold">{resumen.titulo}</span> quedó guardado.
                    Crea una cuenta o inicia sesión para enviarlo a administración.
                  </p>
                  <p className="label-caps text-[9px] text-[var(--color-primary-fixed)] mb-8">Tu progreso no se pierde</p>

                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                    <Link href="/login?next=/dashboard/planes" className="flex-1">
                      <Button fullWidth size="lg">Iniciar sesión</Button>
                    </Link>
                    <Link href="/login?next=/dashboard/planes" className="flex-1">
                      <Button fullWidth size="lg" variant="outline">Crear cuenta</Button>
                    </Link>
                  </div>
                  <button
                    onClick={() => setNecesitaCuenta(false)}
                    className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 hover:text-white transition-colors duration-200 mt-6"
                  >
                    Seguir editando mi plan
                  </button>
                </div>
              </div>
            )}

            {/* PASO: CONFIRMACIÓN */}
            {stepKey === 'resumen' && solicitado && (
              <div className="rounded-[2rem] liquid-glass p-10 md:p-12 text-center">
                <div className="relative z-10 flex flex-col items-center">
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: [0.34, 1.4, 0.64, 1] }}
                    className="w-20 h-20 rounded-full bg-[var(--color-primary-fixed)] text-black flex items-center justify-center mb-7"
                  >
                    <span className="material-symbols-outlined text-[40px]">check</span>
                  </motion.span>
                  <h2 className="font-display text-2xl font-black text-white uppercase tracking-tight mb-4">
                    ¡Solicitud enviada!
                  </h2>
                  <p className="text-sm text-[var(--color-on-surface-variant)]/70 max-w-sm mb-9 leading-relaxed">
                    Tu plan <span className="text-white font-bold">{resumen.titulo}</span> quedó en revisión.
                    Administración aprobará el pago y verás el plan activo en tu perfil.
                  </p>
                  <Link href="/dashboard" className="w-full max-w-xs">
                    <Button fullWidth size="lg">Volver al inicio</Button>
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* ── Navegación inferior ── */}
      {!(stepKey === 'resumen' && (solicitado || necesitaCuenta)) && (
        <footer className="relative z-10 px-5 md:px-10 py-6 shrink-0 border-t border-white/5 bg-[rgba(5,5,5,0.6)] backdrop-blur-xl">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
            <button
              onClick={goBack}
              disabled={stepIdx === 0}
              className="label-caps text-[11px] min-h-[44px] px-3 -ml-3 rounded-xl text-[var(--color-on-surface-variant)] hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:text-[var(--color-on-surface-variant)] disabled:hover:bg-transparent transition-[color,background-color] duration-200 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Atrás
            </button>

            {stepKey !== 'resumen' && (
              <Button size="md" onClick={goNext} disabled={!puedeAvanzar}>
                Continuar
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Button>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
