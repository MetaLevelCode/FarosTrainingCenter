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
import { Card, Badge, Button, Input } from '@/components/ui'
import {
  getTransacciones, getMovimientosDesde, aprobarTransaccion,
  getCategorias, addMovimiento, crearCategoria,
} from '@/lib/firestore'
import type { Transaccion, Movimiento, Categoria } from '@/lib/types'
import { fmtCOP, resumenPlan } from '@/lib/planes'
import { BarraIngresosEgresos, TortaEgresosPorCategoria } from '@/components/admin/FinanzasCharts'
import { exportarFinanzasExcel } from '@/lib/exportarExcel'

const PALETA_CATEGORIAS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
const NUEVA_CATEGORIA = '__nueva__'

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
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState<Record<string, string>>({})
  const [mostrarRechazo, setMostrarRechazo] = useState<string | null>(null)

  // ── Registrar movimiento manual ──
  const [mostrarForm, setMostrarForm] = useState(false)
  const [formTipo, setFormTipo] = useState<'ingreso' | 'egreso'>('egreso')
  const [formCategoriaId, setFormCategoriaId] = useState('')
  const [formNuevaCategoria, setFormNuevaCategoria] = useState('')
  const [formMonto, setFormMonto] = useState('')
  const [formDescripcion, setFormDescripcion] = useState('')
  const [formFecha, setFormFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false)
  const [errorMovimiento, setErrorMovimiento] = useState<string | null>(null)
  // Override opcional del monto por tx (descuento acordado entre admin y alumno).
  // Si queda vacío, se cobra el precio congelado en la transacción.
  const [montoOverride, setMontoOverride] = useState<Record<string, string>>({})
  const [comprobanteModal, setComprobanteModal] = useState<string | null>(null)
  const [comprobanteProxyUrl, setComprobanteProxyUrl] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)

  useEffect(() => {
    // Sin tope de cantidad — "Balance" es un total histórico, no un
    // periodo acotado, así que no se puede recortar por cantidad.
    Promise.all([getTransacciones(), getMovimientosDesde(0), getCategorias()])
      .then(([ts, ms, cs]) => { setTransacciones(ts); setMovimientos(ms); setCategorias(cs) })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [])

  const categoriasDelTipo = useMemo(
    () => categorias.filter((c) => c.tipo === formTipo),
    [categorias, formTipo],
  )

  async function registrarMovimiento() {
    setErrorMovimiento(null)

    const montoNum = Number(formMonto.replace(/[.\s]/g, ''))
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setErrorMovimiento('El monto debe ser un número mayor a 0.')
      return
    }
    if (!formDescripcion.trim()) {
      setErrorMovimiento('Escribe una descripción.')
      return
    }
    if (!formCategoriaId) {
      setErrorMovimiento('Elige una categoría.')
      return
    }
    if (formCategoriaId === NUEVA_CATEGORIA && !formNuevaCategoria.trim()) {
      setErrorMovimiento('Escribe el nombre de la nueva categoría.')
      return
    }

    setGuardandoMovimiento(true)
    try {
      let categoriaId = formCategoriaId
      let categoriaNombre = categorias.find((c) => c.id === categoriaId)?.nombre ?? ''

      if (categoriaId === NUEVA_CATEGORIA) {
        const nombre = formNuevaCategoria.trim()
        const color = PALETA_CATEGORIAS[categoriasDelTipo.length % PALETA_CATEGORIAS.length]
        categoriaId = await crearCategoria({ nombre, tipo: formTipo, color })
        categoriaNombre = nombre
        setCategorias((prev) => [...prev, { id: categoriaId, categoriaId, nombre, tipo: formTipo, color }])
      }

      // Mediodía local — evita que el corrimiento de zona horaria empuje
      // la fecha elegida al día anterior/siguiente.
      const fecha = new Date(`${formFecha}T12:00:00`).getTime()

      await addMovimiento({
        tipo: formTipo, monto: montoNum, categoriaId, categoriaNombre,
        descripcion: formDescripcion.trim(), fecha, origen: 'manual', transaccionId: null,
      })

      setMovimientos((prev) => [
        {
          id: `local-${Date.now()}`, movimientoId: '', tipo: formTipo, monto: montoNum,
          categoriaId, categoriaNombre, descripcion: formDescripcion.trim(),
          fecha, origen: 'manual', transaccionId: null, creadoEn: Date.now(),
        },
        ...prev,
      ])

      setFormMonto('')
      setFormDescripcion('')
      setFormCategoriaId('')
      setFormNuevaCategoria('')
      setMostrarForm(false)
    } catch (err: any) {
      setErrorMovimiento(err.message ?? 'No se pudo registrar el movimiento.')
    } finally {
      setGuardandoMovimiento(false)
    }
  }

  const pendientes = useMemo(() => transacciones.filter((t) => t.estado === 'pendiente'), [transacciones])
  const historial = useMemo(() => transacciones.filter((t) => t.estado !== 'pendiente'), [transacciones])

  const ingresosTotal = useMemo(
    () => movimientos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0),
    [movimientos],
  )
  const egresosTotal = useMemo(
    () => movimientos.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0),
    [movimientos],
  )

  async function aprobar(t: Transaccion) {
    if (!user) return

    // Determinar el monto final: override del admin (si escribió algo) o monto de la tx.
    const overrideStr = montoOverride[t.id]?.trim() ?? ''
    let montoFinal = t.monto
    if (overrideStr !== '') {
      const parsed = Number(overrideStr.replace(/[.\s]/g, ''))
      if (!Number.isFinite(parsed) || parsed <= 0) {
        alert('El monto override debe ser un número mayor a 0.')
        return
      }
      montoFinal = parsed
    }
    if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
      alert('Esta transacción no tiene monto definido. Escribe uno en el campo "Ajustar monto".')
      return
    }

    const alumno = t.nombre_usuario ?? t.usuarioId
    const plan = t.nombre_plan ?? 'Plan solicitado'
    const msg = `Aprobar el pago de ${alumno}:\n\n  Plan: ${plan}\n  Cobrar: ${fmtCOP(montoFinal)}\n\n¿Continuar?`
    if (!window.confirm(msg)) return

    setProcesando(t.id)
    try {
      await aprobarTransaccion(t.id, user.uid,
        overrideStr !== '' ? { montoOverride: montoFinal } : undefined)
      setTransacciones((prev) => prev.map((x) => x.id === t.id
        ? { ...x, estado: 'aprobada', monto: montoFinal } : x))
      getMovimientosDesde(0).then(setMovimientos).catch(console.error)
    } catch (err: any) {
      console.error(err)
      alert(err?.message ?? 'No se pudo aprobar la transacción. Intenta de nuevo.')
    } finally {
      setProcesando(null)
    }
  }

  async function rechazar(t: Transaccion) {
    if (!user) return
    const motivo = motivoRechazo[t.id] ?? 'Sin motivo especificado'
    setProcesando(t.id)
    try {
      const { getAuth } = await import('firebase/auth')
      const idToken = await getAuth().currentUser?.getIdToken()
      if (!idToken) throw new Error('Sesión expirada')

      const res = await fetch(`/api/transacciones/${t.id}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ motivo }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setTransacciones((prev) => prev.map((x) => x.id === t.id
        ? { ...x, estado: 'rechazada', motivo_rechazo: motivo, comprobante_url: null }
        : x))
      setMostrarRechazo(null)
    } catch (err: any) {
      console.error(err)
      alert(err?.message ?? 'No se pudo rechazar la transacción.')
    } finally {
      setProcesando(null)
    }
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Finanzas">
      <div className="space-y-8">

        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Resumen financiero</p>
              <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
                Finanzas
              </h2>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => exportarFinanzasExcel(movimientos, transacciones)}>
                <span className="material-symbols-outlined text-[16px]">download</span>
                Exportar a Excel
              </Button>
              <Button size="sm" onClick={() => { setErrorMovimiento(null); setMostrarForm((v) => !v) }}>
                <span className="material-symbols-outlined text-[16px]">add</span>
                Registrar movimiento
              </Button>
            </div>
          </div>
        </Reveal>

        {/* ── Formulario: registrar movimiento manual ── */}
        {mostrarForm && (
          <Reveal>
            <Card>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                  Registrar movimiento
                </h3>
                <button
                  onClick={() => setMostrarForm(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-on-surface-variant)] hover:text-white hover:bg-white/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                  {(['egreso', 'ingreso'] as const).map((tipo) => (
                    <button
                      key={tipo}
                      onClick={() => { setFormTipo(tipo); setFormCategoriaId('') }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors ${
                        formTipo === tipo
                          ? tipo === 'ingreso'
                            ? 'bg-[var(--color-success-emerald)] text-black'
                            : 'bg-[var(--color-danger-crimson)] text-white'
                          : 'bg-white/5 text-[var(--color-on-surface-variant)]/60 border border-white/10'
                      }`}
                    >
                      {tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                    </button>
                  ))}
                </div>

                <Input
                  label="Descripción"
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="Ej. Arriendo piscina, compra de material..."
                  maxLength={200}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Monto (COP)"
                    inputMode="numeric"
                    value={formMonto}
                    onChange={(e) => setFormMonto(e.target.value)}
                    placeholder="Ej. 150000"
                  />
                  <Input
                    label="Fecha"
                    type="date"
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="[color-scheme:dark]"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label-caps text-[10px] text-[var(--color-on-surface-variant)]">Categoría</label>
                  <select
                    value={formCategoriaId}
                    onChange={(e) => setFormCategoriaId(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
                  >
                    <option value="" disabled>Elige una categoría…</option>
                    {categoriasDelTipo.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                    <option value={NUEVA_CATEGORIA}>+ Nueva categoría…</option>
                  </select>
                </div>

                {formCategoriaId === NUEVA_CATEGORIA && (
                  <Input
                    label={`Nombre de la nueva categoría de ${formTipo}`}
                    value={formNuevaCategoria}
                    onChange={(e) => setFormNuevaCategoria(e.target.value)}
                    placeholder="Ej. Mantenimiento"
                    maxLength={60}
                  />
                )}

                {errorMovimiento && (
                  <p className="text-xs text-[var(--color-danger-crimson)]">{errorMovimiento}</p>
                )}

                <Button fullWidth loading={guardandoMovimiento} onClick={registrarMovimiento}>
                  Guardar movimiento
                </Button>
              </div>
            </Card>
          </Reveal>
        )}

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Ingresos', value: COP.format(ingresosTotal), tone: 'success', icon: 'trending_up' },
            { label: 'Egresos', value: COP.format(egresosTotal), tone: 'danger', icon: 'trending_down' },
            { label: 'Balance', value: COP.format(ingresosTotal - egresosTotal), tone: 'primary', icon: 'account_balance' },
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

        {/* ── Análisis ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Reveal delay={0.1}>
            <BarraIngresosEgresos movimientos={movimientos} />
          </Reveal>
          <Reveal delay={0.14}>
            <TortaEgresosPorCategoria movimientos={movimientos} />
          </Reveal>
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
                        <p className="font-display font-black text-white truncate">{t.nombre_usuario ?? t.usuarioId}</p>
                        <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1 truncate">
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
                            onClick={async () => {
                              setComprobanteModal(t.comprobante_url!)
                              setImgError(false)
                              setImgLoading(true)
                              setComprobanteProxyUrl(null)
                              try {
                                const { getAuth } = await import('firebase/auth')
                                const idToken = await getAuth().currentUser?.getIdToken()
                                if (!idToken) throw new Error('sin token')
                                const res = await fetch(
                                  `/api/comprobante?url=${encodeURIComponent(t.comprobante_url!)}`,
                                  { headers: { Authorization: `Bearer ${idToken}` } },
                                )
                                if (!res.ok) throw new Error(`${res.status}`)
                                const blob = await res.blob()
                                setComprobanteProxyUrl(URL.createObjectURL(blob))
                              } catch {
                                setImgError(true)
                              } finally {
                                setImgLoading(false)
                              }
                            }}
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

                    {/* Ajuste opcional del monto (descuento acordado o
                        "tarifa por confirmar"). Vacío → cobra el precio congelado. */}
                    <div>
                      <label className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 block mb-1.5">
                        {t.monto > 0
                          ? `Ajustar monto (opcional) · precio del alumno: ${fmtCOP(t.monto)}`
                          : 'Definir monto (obligatorio · el alumno pidió tarifa por confirmar)'}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={montoOverride[t.id] ?? ''}
                        onChange={(e) => setMontoOverride((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder={t.monto > 0 ? `Dejar vacío para cobrar ${fmtCOP(t.monto)}` : 'Ej: 120000'}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
                      />
                    </div>

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
      {comprobanteModal && (() => {
        const isPdf = comprobanteModal.toLowerCase().includes('.pdf') || comprobanteModal.toLowerCase().includes('%2fpdf')
        const displayUrl = comprobanteProxyUrl || comprobanteModal
        return (
          <div
            onClick={() => {
              if (comprobanteProxyUrl) URL.revokeObjectURL(comprobanteProxyUrl)
              setComprobanteModal(null)
              setComprobanteProxyUrl(null)
            }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden bg-[#111] border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[20px] ${isPdf ? 'text-[var(--color-danger-crimson)]' : 'text-[var(--color-primary-fixed)]'}`}>
                    {isPdf ? 'picture_as_pdf' : 'receipt_long'}
                  </span>
                  <span className="label-caps text-xs text-white font-bold">
                    {isPdf ? 'Comprobante PDF' : 'Comprobante de pago'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    title="Abrir en nueva pestaña"
                  >
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                    <span>Abrir</span>
                  </a>
                  {isPdf && (
                    <a
                      href={displayUrl}
                      download="comprobante.pdf"
                      className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                      title="Descargar PDF"
                    >
                      <span className="material-symbols-outlined text-[15px]">download</span>
                      <span>Descargar</span>
                    </a>
                  )}
                  <button
                    onClick={() => {
                      if (comprobanteProxyUrl) URL.revokeObjectURL(comprobanteProxyUrl)
                      setComprobanteModal(null)
                      setComprobanteProxyUrl(null)
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-on-surface-variant)] hover:text-white hover:bg-white/10 transition-colors ml-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center p-4 min-h-[420px] bg-black/30 overflow-auto">
                {imgLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <span className="w-8 h-8 border-2 border-white/20 border-t-[var(--color-primary-fixed)] rounded-full animate-spin" />
                    <p className="text-xs text-[var(--color-on-surface-variant)]/60">Cargando comprobante seguro…</p>
                  </div>
                ) : imgError ? (
                  <div className="text-center space-y-4 py-8 max-w-sm">
                    <span className="material-symbols-outlined text-[48px] text-[var(--color-danger-crimson)]">broken_image</span>
                    <p className="text-sm text-white font-semibold">No se pudo cargar la vista previa directa.</p>
                    <p className="text-xs text-[var(--color-on-surface-variant)]/60">Puedes abrir el archivo directamente en una pestaña nueva o descargarlo.</p>
                    <div className="flex justify-center gap-2 pt-2">
                      <a
                        href={comprobanteModal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-primary-fixed)] text-black font-bold text-xs hover:opacity-90 transition-opacity"
                      >
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        Abrir comprobante
                      </a>
                    </div>
                  </div>
                ) : isPdf ? (
                  <div className="w-full h-full flex flex-col">
                    <object
                      data={displayUrl}
                      type="application/pdf"
                      className="w-full h-[72vh] rounded-xl border border-white/10 shadow-lg"
                    >
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 bg-white/[0.02] rounded-xl border border-white/5">
                        <span className="material-symbols-outlined text-[48px] text-[var(--color-primary-fixed)]">picture_as_pdf</span>
                        <p className="text-sm text-white font-medium">Este navegador o dispositivo no soporta previsualización de PDF incrustada.</p>
                        <div className="flex gap-3">
                          <a
                            href={displayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-primary-fixed)] text-black font-bold text-xs hover:opacity-90 transition-opacity"
                          >
                            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                            Abrir PDF en pestaña nueva
                          </a>
                          <a
                            href={displayUrl}
                            download="comprobante.pdf"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">download</span>
                            Descargar
                          </a>
                        </div>
                      </div>
                    </object>
                  </div>
                ) : comprobanteProxyUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={comprobanteProxyUrl}
                    alt="Comprobante de pago"
                    className="max-w-full max-h-[75vh] rounded-lg object-contain select-none shadow-lg"
                    onError={() => setImgError(true)}
                    draggable={false}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )
      })()}
    </GuardedShell>
  )
}
