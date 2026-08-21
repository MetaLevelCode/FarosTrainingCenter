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
import { SubirComprobante } from '@/components/dashboard/SubirComprobante'
import { getTransaccionesUsuario, getSuscripcionesUsuario, getSedes, getGrupos, getTarifas } from '@/lib/firestore'
import { parseVencimiento } from '@/lib/matricula'
import type { Suscripcion, Sede, Grupo as GrupoFS, Tarifas } from '@/lib/types'
import { Card } from '@/components/ui'
import {
  TIPOS, GRUPOS as GRUPOS_FALLBACK, PERSONALES, CONJUNTOS, FRECUENCIAS,
  SELECCION_INICIAL, calcularPrecio, resumenPlan, fmtCOP,
  TARIFAS_FALLBACK,
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
  const [transaccionId, setTransaccionId] = useState<string | null>(null)
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null)
  // Chequeo inicial: si ya existe tx pendiente, bloqueamos el wizard.
  // Sin comprobante → ir al upload. Con comprobante → pantalla "en revisión".
  const [checkingPendiente, setCheckingPendiente] = useState(true)
  const [txPendienteId, setTxPendienteId] = useState<string | null>(null)
  const [txEnRevision, setTxEnRevision] = useState(false)
  const [suscripcionDetalle, setSuscripcionDetalle] = useState<Suscripcion | null>(null)
  // Catálogo dinámico desde Firestore (sedes/grupos/tarifas). Si no hay
  // conexión o el seed no se ha corrido, seguimos usando el fallback estático.
  const [sedes, setSedes] = useState<Sede[]>([])
  const [gruposFS, setGruposFS] = useState<GrupoFS[]>([])
  const [tarifas, setTarifas] = useState<Tarifas | null>(null)

  useEffect(() => {
    Promise.all([getSedes(), getGrupos(), getTarifas()])
      .then(([s, g, t]) => { setSedes(s); setGruposFS(g); if (t) setTarifas(t) })
      .catch(() => {}) // silencioso — usamos fallback
  }, [])

  // Grupos a mostrar: los de Firestore si el seed corrió, si no el fallback estático.
  const gruposEfectivos = useMemo(() => {
    if (gruposFS.length === 0) return GRUPOS_FALLBACK
    return gruposFS.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      horarios: g.horarios,
      disponible: g.disponible,
      nivel: g.nivel,
      cupos: `Cupo máximo ${g.cupoMaximo}`,
      coach: g.coach ?? '',
    }))
  }, [gruposFS])

  useEffect(() => {
    if (!user?.uid) { setCheckingPendiente(false); return }
    getTransaccionesUsuario(user.uid)
      .then((txs) => {
        const pendiente = txs.find((t) => t.estado === 'pendiente')
        if (pendiente) {
          if (pendiente.comprobante_url) {
            setTxEnRevision(true)
          } else {
            setTxPendienteId(pendiente.id)
          }
        }
      })
      .catch(() => {})
      .finally(() => setCheckingPendiente(false))
  }, [user?.uid])

  // Detalle de la suscripción activa — necesario para conocer sesiones_compradas
  // y fecha_compra, que suscripcionActiva (denormalizado en usuario) no incluye.
  useEffect(() => {
    const suscId = user?.suscripcionActiva?.suscripcionId
    if (!user?.uid || !suscId) return
    getSuscripcionesUsuario(user.uid)
      .then((ss) => {
        const s = ss.find((x) => x.id === suscId) ?? ss[0] ?? null
        setSuscripcionDetalle(s)
      })
      .catch(() => {})
  }, [user?.uid, user?.suscripcionActiva?.suscripcionId])

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
  const tarifasEfectivas = tarifas ?? TARIFAS_FALLBACK
  const precio = useMemo(() => calcularPrecio(sel, tarifasEfectivas), [sel, tarifasEfectivas])
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

      setTransaccionId(data.transaccionId)
      setSolicitado(true)
    } catch (err: any) {
      setErrorSolicitud(err.message ?? 'No se pudo enviar la solicitud. Intenta de nuevo.')
    } finally {
      setSolicitando(false)
    }
  }

  if (loading || checkingPendiente) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#050505' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  // Ya tiene una suscripción activa — muestra resumen y bloquea el wizard
  const suscActiva = user?.suscripcionActiva
  if (suscActiva && suscActiva.estado === 'activa' && !solicitado) {
    const venceDate = parseVencimiento(suscActiva.fechaVencimiento)
    const vence = venceDate?.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    const hoy = Date.now()
    const diasRestantes = venceDate
      ? Math.max(0, Math.ceil((venceDate.getTime() - hoy) / 86_400_000))
      : null

    const totalSesiones = suscripcionDetalle?.sesiones_compradas
      ?? (suscActiva.sesionesRestantes + (user?.estadisticas?.clasesAsistidas ?? 0))
    const restantes = suscActiva.sesionesRestantes
    const usadas = Math.max(0, totalSesiones - restantes)
    const pctSesiones = totalSesiones > 0 ? Math.min(100, Math.round((usadas / totalSesiones) * 100)) : 0

    const compraDate = parseVencimiento(suscripcionDetalle?.fecha_compra)
    const duracionTotalMs = compraDate && venceDate ? venceDate.getTime() - compraDate.getTime() : 0
    const transcurridoMs = compraDate ? Math.max(0, hoy - compraDate.getTime()) : 0
    const pctTiempo = duracionTotalMs > 0 ? Math.min(100, Math.round((transcurridoMs / duracionTotalMs) * 100)) : 0

    const asistidas = user?.estadisticas?.clasesAsistidas ?? 0
    const reservadas = user?.estadisticas?.clasesReservadas ?? 0
    const tasa = user?.estadisticas?.tasaAsistencia ?? 0

    const vencePronto = diasRestantes !== null && diasRestantes <= 7
    const tono = vencePronto ? 'danger' : 'primary'

    return (
      <div className="relative min-h-dvh flex flex-col">
        <WaterBackground />
        <header className="relative z-10 h-20 px-5 md:px-10 flex items-center justify-between shrink-0">
          <FarosWordmark size="sm" />
          <Link href="/dashboard" aria-label="Volver al dashboard"
            className="w-11 h-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-[var(--color-on-surface-variant)] hover:text-white hover:border-white/25 transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </Link>
        </header>

        <main className="relative z-10 flex-1 px-5 md:px-10 pb-16 pt-4">
          <div className="w-full max-w-3xl mx-auto space-y-8">

            {/* ── Encabezado ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Tu plan activo</p>
              <h2 className="font-display text-3xl md:text-5xl font-black text-white leading-none tracking-tighter uppercase mb-3">
                {suscActiva.nombrePlan}
              </h2>
              <div className="flex items-center gap-2 text-xs text-[var(--color-on-surface-variant)]/60">
                <span className="w-2 h-2 rounded-full bg-[var(--color-success-emerald)] shadow-[0_0_10px_currentColor]" />
                <span className="label-caps tracking-[0.15em]">Activo</span>
              </div>
            </motion.div>

            {/* ── KPIs principales ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {/* Sesiones restantes con barra de progreso */}
              <Card padding="lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="material-symbols-outlined text-[22px] text-[var(--color-primary-fixed)]">event_available</span>
                  <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Sesiones</span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-display text-5xl font-black text-white leading-none">{restantes}</span>
                  <span className="text-sm text-[var(--color-on-surface-variant)]/50">/ {totalSesiones}</span>
                </div>
                <p className="text-xs text-[var(--color-on-surface-variant)]/60 mb-4">
                  {usadas} usadas · {restantes} disponibles
                </p>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[var(--color-primary-fixed)] shadow-[0_0_12px_rgba(230,255,0,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${pctSesiones}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
                  />
                </div>
              </Card>

              {/* Vencimiento con días restantes */}
              <Card padding="lg">
                <div className="flex items-center justify-between mb-4">
                  <span className={`material-symbols-outlined text-[22px] ${
                    tono === 'danger' ? 'text-[var(--color-danger-crimson)]' : 'text-[var(--color-primary-fixed)]'
                  }`}>schedule</span>
                  <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Vencimiento</span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`font-display text-5xl font-black leading-none ${
                    tono === 'danger' ? 'text-[var(--color-danger-crimson)]' : 'text-white'
                  }`}>
                    {diasRestantes ?? '—'}
                  </span>
                  <span className="text-sm text-[var(--color-on-surface-variant)]/50">días</span>
                </div>
                <p className="text-xs text-[var(--color-on-surface-variant)]/60 mb-4">
                  {vence ? `Vence el ${vence}` : 'Fecha no disponible'}
                </p>
                {duracionTotalMs > 0 && (
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        tono === 'danger'
                          ? 'bg-[var(--color-danger-crimson)]'
                          : 'bg-white/40'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pctTiempo}%` }}
                      transition={{ duration: 0.8, delay: 0.4, ease: EASE }}
                    />
                  </div>
                )}
              </Card>
            </motion.div>

            {/* ── Aprovechamiento ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease: EASE }}
            >
              <Card padding="lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mb-1">Aprovechamiento del plan</p>
                    <h3 className="font-display text-xl font-extrabold text-white uppercase tracking-tight">
                      {tasa >= 80 ? 'Excelente ritmo' : tasa >= 50 ? 'Vas bien' : tasa > 0 ? 'Ponle el pecho' : 'Sin registros aún'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-4xl font-black text-[var(--color-primary-fixed)] leading-none">
                      {Math.round(tasa * 100)}%
                    </p>
                    <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-1">Asistencia</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/5">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[16px] text-[var(--color-success-emerald)]">check_circle</span>
                      <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/60">Clases hechas</span>
                    </div>
                    <p className="font-display text-2xl font-black text-white">{asistidas}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[16px] text-white/40">calendar_month</span>
                      <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/60">Reservadas</span>
                    </div>
                    <p className="font-display text-2xl font-black text-white">{reservadas}</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* ── Aviso vencimiento cercano ── */}
            {vencePronto && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.28, ease: EASE }}
                className="rounded-2xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] p-5 flex items-center gap-4"
              >
                <span className="material-symbols-outlined text-[22px] text-[var(--color-danger-crimson)] shrink-0">warning</span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black text-white text-sm">Tu plan vence pronto</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]/60 mt-0.5">
                    Contacta a administración para renovarlo antes de que caduque.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Acción ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
            >
              <Link href="/dashboard">
                <Button variant="outline" size="lg" fullWidth>
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Volver al dashboard
                </Button>
              </Link>
            </motion.div>
          </div>
        </main>
      </div>
    )
  }

  // Tx con comprobante ya subido — esperando aprobación del admin
  if (txEnRevision) {
    return (
      <div className="relative min-h-dvh flex flex-col">
        <WaterBackground />
        <header className="relative z-10 h-20 px-5 md:px-10 flex items-center justify-between shrink-0">
          <FarosWordmark size="sm" />
          <Link href="/dashboard" aria-label="Volver al dashboard"
            className="w-11 h-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-[var(--color-on-surface-variant)] hover:text-white hover:border-white/25 transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </Link>
        </header>
        <main className="relative z-10 flex-1 flex items-center justify-center px-5 md:px-10 pb-10">
          <div className="w-full max-w-md text-center">
            <span className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-7">
              <span className="material-symbols-outlined text-[40px] text-[var(--color-on-surface-variant)]/60">pending_actions</span>
            </span>
            <h2 className="font-display text-2xl font-black text-white uppercase tracking-tight mb-4">
              Pago en revisión
            </h2>
            <p className="text-sm text-[var(--color-on-surface-variant)]/70 leading-relaxed mb-8">
              Ya enviaste tu comprobante. La administración lo está revisando y te notificará cuando tu plan esté activo.
            </p>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" fullWidth>Volver al dashboard</Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // Tx pendiente sin comprobante detectada al abrir la página
  if (txPendienteId && !comprobanteUrl) {
    return (
      <div className="relative min-h-dvh flex flex-col">
        <WaterBackground />
        <header className="relative z-10 h-20 px-5 md:px-10 flex items-center justify-between shrink-0">
          <FarosWordmark size="sm" />
          <Link href="/dashboard" aria-label="Volver al dashboard"
            className="w-11 h-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-[var(--color-on-surface-variant)] hover:text-white hover:border-white/25 transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </Link>
        </header>
        <main className="relative z-10 flex-1 flex items-center justify-center px-5 md:px-10 pb-10">
          <div className="w-full max-w-xl">
            <span className="label-caps text-[10px] text-[var(--color-primary-fixed)]">Último paso</span>
            <h1 className="font-display text-[clamp(1.75rem,5vw,2.5rem)] font-black text-white uppercase tracking-tighter leading-tight mt-2 mb-3">
              Sube tu comprobante
            </h1>
            <p className="text-sm text-[var(--color-on-surface-variant)]/70 mb-8 leading-relaxed">
              Ya tienes una solicitud de plan en revisión. Adjunta el comprobante de tu transferencia para que administración pueda aprobarla.
            </p>
            <SubirComprobante
              transaccionId={txPendienteId}
              uid={user!.uid}
              onSubido={(url) => { setComprobanteUrl(url); setTxPendienteId(null) }}
            />
          </div>
        </main>
      </div>
    )
  }

  // Éxito después de subir comprobante (desde tx pendiente detectada en mount)
  if (comprobanteUrl && !solicitado) {
    return (
      <div className="relative min-h-dvh flex items-center justify-center" style={{ background: '#050505' }}>
        <WaterBackground />
        <div className="relative z-10 text-center px-6 max-w-sm">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.4, 0.64, 1] }}
            className="w-20 h-20 rounded-full bg-[var(--color-primary-fixed)] text-black flex items-center justify-center mx-auto mb-7"
          >
            <span className="material-symbols-outlined text-[40px]">check</span>
          </motion.span>
          <h2 className="font-display text-2xl font-black text-white uppercase tracking-tight mb-4">
            ¡Comprobante enviado!
          </h2>
          <p className="text-sm text-[var(--color-on-surface-variant)]/70 mb-9 leading-relaxed">
            Administración revisará el pago y activará tu plan pronto.
          </p>
          <Link href="/dashboard"><Button fullWidth size="lg">Volver al inicio</Button></Link>
        </div>
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
                {gruposEfectivos.map((g) => (
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
                    const p = calcularPrecio({ ...sel, week: f.week }, tarifasEfectivas)
                    return (
                      <ChoiceCard
                        key={f.week}
                        selected={sel.week === f.week}
                        onClick={() => setSel((s) => ({ ...s, week: f.week }))}
                        icon="calendar_month"
                        title={f.label}
                        desc={sel.tipo === 'grupal'
                          ? `${fmtCOP(tarifasEfectivas.grupoPorSesion[f.week])} por sesión`
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

            {/* PASO: SUBIR COMPROBANTE (después de crear la transacción) */}
            {stepKey === 'resumen' && solicitado && transaccionId && !comprobanteUrl && (
              <div className="rounded-[2rem] liquid-glass p-8 md:p-10">
                <div className="relative z-10">
                  <span className="label-caps text-[10px] text-[var(--color-primary-fixed)]">Último paso</span>
                  <h2 className="font-display text-2xl font-black text-white uppercase tracking-tight mt-2 mb-3">
                    Sube tu comprobante
                  </h2>
                  <p className="text-sm text-[var(--color-on-surface-variant)]/70 mb-8 leading-relaxed">
                    Realiza la transferencia al número de cuenta de Faros y adjunta el comprobante.
                    Administración lo revisará y activará tu plan <span className="text-white font-bold">{resumen.titulo}</span>.
                  </p>
                  <SubirComprobante
                    transaccionId={transaccionId}
                    uid={user!.uid}
                    onSubido={(url) => setComprobanteUrl(url)}
                  />
                </div>
              </div>
            )}

            {/* PASO: ÉXITO FINAL */}
            {stepKey === 'resumen' && solicitado && comprobanteUrl && (
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
                    ¡Comprobante enviado!
                  </h2>
                  <p className="text-sm text-[var(--color-on-surface-variant)]/70 max-w-sm mb-9 leading-relaxed">
                    Tu plan <span className="text-white font-bold">{resumen.titulo}</span> está en revisión.
                    Administración aprobará el pago y verás tu plan activo en el dashboard.
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
