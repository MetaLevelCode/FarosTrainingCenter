'use client'

// ============================================================
// FAROS — Admin · Finanzas
// Lee colecciones `transacciones` y `movimientos`.
// Aprobar transacción → crea suscripción + movimiento ingreso.
// Rechazar → marca como rechazada con motivo.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import { getTransacciones, getMovimientos, aprobarTransaccion, rechazarTransaccion, getPlanes } from '@/lib/firestore'
import type { Transaccion, Movimiento, Plan } from '@/lib/types'
import { fmtCOP, resumenPlan } from '@/lib/planes'

const EASE = [0.22, 1, 0.36, 1] as const
const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >{children}</motion.div>
  )
}

export default function FinanzasPage() {
  const { authorized, loading, user } = useRoleGuard(['admin'])
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [planes, setPlanes] = useState<Plan[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState<Record<string, string>>({})
  const [mostrarRechazo, setMostrarRechazo] = useState<string | null>(null)
  const [planSeleccionado, setPlanSeleccionado] = useState<Record<string, string>>({})
  const [comprobanteModal, setComprobanteModal] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)

  useEffect(() => {
    Promise.all([getTransacciones(), getMovimientos(), getPlanes()])
      .then(([ts, ms, ps]) => { setTransacciones(ts); setMovimientos(ms); setPlanes(ps) })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [])

  const pendientes = useMemo(() => transacciones.filter((t) => t.estado === 'pendiente'), [transacciones])
  const historial = useMemo(() => transacciones.filter((t) => t.estado !== 'pendiente'), [transacciones])

  const ingresosMes = useMemo(
    () => movimientos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0),
    [movimientos],
  )
  const egresosMes = useMemo(
    () => movimientos.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0),
    [movimientos],
  )

  async function aprobar(t: Transaccion) {
    if (!user) return
    const planId = planSeleccionado[t.id] ?? t.planId
    if (!planId) {
      alert('Selecciona el plan de Firestore antes de aprobar.')
      return
    }
    setProcesando(t.id)
    try {
      await aprobarTransaccion(t.id, user.uid, planId, t.usuarioId)
      setTransacciones((prev) => prev.map((x) => x.id === t.id ? { ...x, estado: 'aprobada' } : x))
      getMovimientos().then(setMovimientos).catch(console.error)
    } catch (err) {
      console.error(err)
    } finally {
      setProcesando(null)
    }
  }

  async function rechazar(t: Transaccion) {
    if (!user) return
    const motivo = motivoRechazo[t.id] ?? 'Sin motivo especificado'
    setProcesando(t.id)
    try {
      await rechazarTransaccion(t.id, user.uid, motivo)
      setTransacciones((prev) => prev.map((x) => x.id === t.id ? { ...x, estado: 'rechazada', motivo_rechazo: motivo } : x))
      setMostrarRechazo(null)
    } catch (err) {
      console.error(err)
    } finally {
      setProcesando(null)
    }
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Finanzas">
      <div className="space-y-8">

        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Resumen financiero</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Finanzas
            </h2>
          </div>
        </Reveal>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Ingresos', value: COP.format(ingresosMes), tone: 'success', icon: 'trending_up' },
            { label: 'Egresos', value: COP.format(egresosMes), tone: 'danger', icon: 'trending_down' },
            { label: 'Balance', value: COP.format(ingresosMes - egresosMes), tone: 'primary', icon: 'account_balance' },
            { label: 'Pendientes', value: String(pendientes.length), tone: 'white', icon: 'pending' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={0.05 * i}>
              <Card>
                <span className={`material-symbols-outlined text-[20px] mb-3 ${
                  s.tone === 'success' ? 'text-[var(--color-success-emerald)]'
                  : s.tone === 'danger' ? 'text-[var(--color-danger-crimson)]'
                  : s.tone === 'primary' ? 'text-[var(--color-primary-fixed)]'
                  : 'text-white/40'
                }`}>{s.icon}</span>
                <p className={`font-display text-xl font-black leading-none ${
                  s.tone === 'success' ? 'text-[var(--color-success-emerald)]'
                  : s.tone === 'danger' ? 'text-[var(--color-danger-crimson)]'
                  : s.tone === 'primary' ? 'text-[var(--color-primary-fixed)]'
                  : 'text-white'
                }`}>{s.value}</p>
                <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-2">{s.label}</p>
              </Card>
            </Reveal>
          ))}
        </div>

        {/* ── Transacciones pendientes ── */}
        <Reveal delay={0.16}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Pagos pendientes de aprobar
              </h3>
              {pendientes.length > 0 && (
                <Badge variant="danger">{pendientes.length}</Badge>
              )}
            </div>

            {cargando ? (
              <div className="px-6 py-10 text-center text-sm text-[var(--color-on-surface-variant)]/40">Cargando…</div>
            ) : pendientes.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[var(--color-on-surface-variant)]/60">
                No hay pagos pendientes de revisión.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {pendientes.map((t) => (
                  <div key={t.id} className="p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-display font-black text-white">{t.nombre_usuario ?? t.usuarioId}</p>
                        <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1">
                          {t.nombre_plan ?? t.planId} · {new Date(t.fecha_solicitud).toLocaleDateString('es-CO')}
                        </p>
                        {/* Resumen del plan que armó el alumno en el wizard */}
                        {t.seleccion && (
                          <p className="text-xs text-[var(--color-on-surface-variant)]/60 mt-1">
                            Solicitud: {resumenPlan(t.seleccion).subtitulo}
                            {t.monto_disponible === false && ' · Tarifa por confirmar'}
                          </p>
                        )}
                        {t.comprobante_url && (
                          <button
                            onClick={() => { setComprobanteModal(t.comprobante_url!); setImgError(false); setImgLoading(true) }}
                            className="label-caps text-[10px] text-[var(--color-primary-fixed)] mt-1 inline-flex items-center gap-1 hover:underline"
                          >
                            <span className="material-symbols-outlined text-[14px]">receipt</span>
                            Ver comprobante
                          </button>
                        )}
                      </div>
                      <p className="font-display text-xl font-black text-[var(--color-primary-fixed)] shrink-0">
                        {t.monto > 0 ? COP.format(t.monto) : 'Por confirmar'}
                      </p>
                    </div>

                    {/* Selector de plan de Firestore (obligatorio para aprobar) */}
                    {planes.length > 0 && (
                      <div>
                        <label className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 block mb-1.5">
                          Asignar plan de Firestore *
                        </label>
                        <select
                          value={planSeleccionado[t.id] ?? ''}
                          onChange={(e) => setPlanSeleccionado((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
                        >
                          <option value="" className="bg-[#0a0a0a]">Seleccionar plan…</option>
                          {planes.map((p) => (
                            <option key={p.id} value={p.id} className="bg-[#0a0a0a]">
                              {p.nombre} — {fmtCOP(p.precio_total)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {mostrarRechazo === t.id ? (
                      <div className="space-y-3">
                        <input
                          value={motivoRechazo[t.id] ?? ''}
                          onChange={(e) => setMotivoRechazo((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="Motivo del rechazo..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
                        />
                        <div className="flex gap-3">
                          <Button size="sm" variant="danger" loading={procesando === t.id} onClick={() => rechazar(t)}>
                            Confirmar rechazo
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setMostrarRechazo(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <Button size="sm" loading={procesando === t.id} onClick={() => aprobar(t)}>
                          Aprobar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setMostrarRechazo(t.id)}>
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Reveal>

        {/* ── Historial de movimientos ── */}
        <Reveal delay={0.22}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/10 bg-white/[0.02]">
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Historial de movimientos
              </h3>
            </div>
            {movimientos.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[var(--color-on-surface-variant)]/60">
                Sin movimientos registrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-white/5">
                    <tr>
                      {['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Monto'].map((h) => (
                        <th key={h} className={`px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 ${h === 'Monto' ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {movimientos.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.03] transition-colors duration-200">
                        <td className="px-6 py-4 text-xs text-[var(--color-on-surface-variant)]/60 whitespace-nowrap">
                          {new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--color-on-surface)] max-w-[200px] truncate">{m.descripcion}</td>
                        <td className="px-6 py-4">
                          <Badge variant="default">{m.categoriaNombre}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={m.tipo === 'ingreso' ? 'success' : 'danger'}>
                            {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                          </Badge>
                        </td>
                        <td className={`px-6 py-4 font-display font-black text-right whitespace-nowrap ${
                          m.tipo === 'ingreso' ? 'text-[var(--color-success-emerald)]' : 'text-[var(--color-danger-crimson)]'
                        }`}>
                          {m.tipo === 'ingreso' ? '+' : '−'}{COP.format(m.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </Reveal>

        {/* ── Transacciones aprobadas / rechazadas ── */}
        {historial.length > 0 && (
          <Reveal delay={0.28}>
            <Card padding="none" className="overflow-hidden">
              <div className="p-6 md:p-8 border-b border-white/10 bg-white/[0.02]">
                <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                  Transacciones procesadas
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-white/5">
                    <tr>
                      {['Usuario', 'Plan', 'Fecha', 'Monto', 'Estado'].map((h) => (
                        <th key={h} className="px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {historial.map((t) => (
                      <tr key={t.id} className="hover:bg-white/[0.03] transition-colors duration-200">
                        <td className="px-6 py-4 text-sm text-white">{t.nombre_usuario ?? t.usuarioId}</td>
                        <td className="px-6 py-4 text-xs text-[var(--color-on-surface-variant)]/70">{t.nombre_plan ?? t.planId}</td>
                        <td className="px-6 py-4 text-xs text-[var(--color-on-surface-variant)]/60 whitespace-nowrap">
                          {new Date(t.fecha_solicitud).toLocaleDateString('es-CO')}
                        </td>
                        <td className="px-6 py-4 font-display font-black text-white text-sm">{COP.format(t.monto)}</td>
                        <td className="px-6 py-4">
                          <Badge variant={t.estado === 'aprobada' ? 'success' : 'danger'}>
                            {t.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </Reveal>
        )}
      </div>

      {/* ── Modal comprobante ── */}
      {comprobanteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setComprobanteModal(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl overflow-hidden bg-[#111] border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60">Comprobante de pago</span>
              <button
                onClick={() => setComprobanteModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-on-surface-variant)] hover:text-white hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex items-center justify-center p-4 min-h-[300px] bg-black/20">
              {comprobanteModal.includes('.pdf') || comprobanteModal.includes('%2Fpdf') ? (
                <iframe
                  src={comprobanteModal}
                  className="w-full h-[70vh] rounded-lg"
                  title="Comprobante PDF"
                />
              ) : imgError ? (
                <div className="text-center space-y-4 py-8">
                  <span className="material-symbols-outlined text-[48px] text-white/20">broken_image</span>
                  <p className="text-sm text-[var(--color-on-surface-variant)]/60">No se pudo cargar la imagen.</p>
                  <a
                    href={comprobanteModal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[var(--color-primary-fixed)] text-sm hover:underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    Abrir imagen
                  </a>
                </div>
              ) : (
                <div className="relative w-full flex items-center justify-center">
                  {imgLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-8 h-8 border-2 border-white/20 border-t-[var(--color-primary-fixed)] rounded-full animate-spin" />
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={comprobanteModal}
                    alt="Comprobante de pago"
                    className={`max-w-full max-h-[75vh] rounded-lg object-contain select-none transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
                    onClick={(e) => e.preventDefault()}
                    draggable={false}
                    onLoadStart={() => { setImgLoading(true); setImgError(false) }}
                    onLoad={() => setImgLoading(false)}
                    onError={() => { setImgLoading(false); setImgError(true) }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </GuardedShell>
  )
}
