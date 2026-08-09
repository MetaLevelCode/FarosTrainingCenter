'use client'

// ============================================================
// FAROS — Panel Admin
// KPIs, gráfico de ingresos y cola de pagos pendientes.
// Todos los datos vienen de Firestore en tiempo real.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button, Spinner } from '@/components/ui'
import { getMovimientos, getTransacciones, getUsuarios } from '@/lib/firestore'
import { fmtCOP } from '@/lib/planes'
import type { Movimiento, Transaccion, Usuario } from '@/lib/types'

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

function iniciales(u: Pick<Usuario, 'nombres' | 'apellidos'>) {
  return `${u.nombres.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase()
}

// Agrupa movimientos por mes (últimos 6) y suma ingresos
function buildStream(movimientos: Movimiento[]) {
  const ahora = new Date()
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - (5 - i), 1)
    return {
      mes: d.toLocaleDateString('es-CO', { month: 'short' }).toUpperCase().replace('.', ''),
      year: d.getFullYear(),
      month: d.getMonth(),
      total: 0,
    }
  })
  for (const m of movimientos) {
    if (m.tipo !== 'ingreso') continue
    const d = new Date(m.fecha)
    const slot = meses.find((s) => s.year === d.getFullYear() && s.month === d.getMonth())
    if (slot) slot.total += m.monto
  }
  const max = Math.max(...meses.map((s) => s.total), 1)
  return meses.map((s) => ({ ...s, pct: Math.round((s.total / max) * 100) }))
}

export default function AdminPage() {
  const { authorized, loading } = useRoleGuard(['admin'])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([getMovimientos(200), getTransacciones(), getUsuarios()])
      .then(([ms, ts, us]) => { setMovimientos(ms); setTransacciones(ts); setUsuarios(us) })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [])

  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime()

  const ingresosMes = useMemo(
    () => movimientos.filter((m) => m.tipo === 'ingreso' && m.fecha >= inicioMes).reduce((s, m) => s + m.monto, 0),
    [movimientos, inicioMes],
  )
  const egresosMes = useMemo(
    () => movimientos.filter((m) => m.tipo === 'egreso' && m.fecha >= inicioMes).reduce((s, m) => s + m.monto, 0),
    [movimientos, inicioMes],
  )
  const atletasActivos = useMemo(
    () => usuarios.filter((u) => u.rol === 'estudiante' && (u as any).activo !== false).length,
    [usuarios],
  )
  const pendientes = useMemo(() => transacciones.filter((t) => t.estado === 'pendiente'), [transacciones])
  const stream = useMemo(() => buildStream(movimientos), [movimientos])

  const KPIS = [
    { label: 'Ingresos del mes', value: fmtCOP(ingresosMes), icon: 'trending_up', tone: 'success' as const },
    { label: 'Egresos del mes', value: fmtCOP(egresosMes), icon: 'trending_down', tone: 'danger' as const },
    { label: 'Atletas activos', value: String(atletasActivos), icon: 'shield_person', tone: 'primary' as const },
    { label: 'Pagos pendientes', value: String(pendientes.length), icon: 'pending_actions', tone: pendientes.length > 0 ? 'danger' as const : 'primary' as const },
  ]

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Admin Console">
      <div className="space-y-8">

        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Torre de Control</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Panel Admin
            </h2>
          </div>
        </Reveal>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {cargando
            ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl animate-pulse bg-white/5" />
            ))
            : KPIS.map((kpi, i) => (
              <Reveal key={kpi.label} delay={0.05 * i}>
                <Card className="h-full">
                  <div className="flex justify-between items-start mb-4">
                    <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/70">{kpi.label}</span>
                    <span className={`material-symbols-outlined p-2 rounded-xl text-[20px] ${
                      kpi.tone === 'success' ? 'text-[var(--color-success-emerald)] bg-[rgba(16,185,129,0.1)]'
                      : kpi.tone === 'danger' ? 'text-[var(--color-danger-crimson)] bg-[rgba(239,68,68,0.1)]'
                      : 'text-[var(--color-primary-fixed)] bg-[rgba(230,255,0,0.1)]'
                    }`}>{kpi.icon}</span>
                  </div>
                  <p className="font-display text-[28px] font-black text-white tracking-tighter leading-none">{kpi.value}</p>
                </Card>
              </Reveal>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Gráfico de ingresos (últimos 6 meses) ── */}
          <div className="lg:col-span-8">
            <Reveal delay={0.15}>
              <Card padding="none" className="overflow-hidden h-full">
                <div className="p-6 md:p-8 border-b border-white/5 flex items-center gap-4 bg-white/[0.01]">
                  <span className="w-3 h-3 rounded-full bg-[var(--color-primary-fixed)] shadow-[0_0_10px_#e6ff00]" />
                  <h3 className="label-caps text-xs text-white">Ingresos — últimos 6 meses</h3>
                </div>
                <div className="p-6 md:p-10 min-h-[280px] flex items-end justify-between gap-3 md:gap-6 relative">
                  <div className="absolute inset-x-6 md:inset-x-10 inset-y-10 flex flex-col justify-between pointer-events-none opacity-5">
                    {[0, 1, 2, 3].map((n) => <div key={n} className="w-full border-t border-white" />)}
                  </div>
                  {stream.map((bar, i) => (
                    <div key={bar.mes} className="flex-1 flex flex-col items-center group relative z-10">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(bar.pct * 2, 4)}px` }}
                        transition={{ duration: 0.7, delay: 0.05 * i, ease: EASE }}
                        className="w-full max-w-[54px] rounded-xl group-hover:brightness-125 transition-[filter] duration-200"
                        style={{ background: 'linear-gradient(to top, rgba(230,255,0,0.1), #e6ff00)', boxShadow: '0 0 15px rgba(230,255,0,0.2)' }}
                      />
                      <p className="mt-4 text-[10px] font-black uppercase text-[var(--color-on-surface-variant)]/60 tracking-[0.2em]">{bar.mes}</p>
                      {bar.total > 0 && (
                        <p className="text-[9px] text-[var(--color-primary-fixed)]/60 mt-1">{fmtCOP(bar.total)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
          </div>

          {/* ── Cola de pagos pendientes ── */}
          <div className="lg:col-span-4">
            <Reveal delay={0.2}>
              <Card padding="none" className="overflow-hidden h-full flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                  <div>
                    <h3 className="label-caps text-xs text-white">Pagos pendientes</h3>
                    <p className="text-[9px] text-[var(--color-on-surface-variant)]/50 mt-1">
                      Aprueba o rechaza en Finanzas
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${
                    pendientes.length > 0
                      ? 'bg-[var(--color-danger-crimson)] text-white'
                      : 'bg-[rgba(16,185,129,0.15)] text-[var(--color-success-emerald)]'
                  }`}>
                    {pendientes.length > 0 ? `${pendientes.length} en cola` : 'Al día'}
                  </span>
                </div>

                <div className="flex-1 divide-y divide-white/5 overflow-y-auto max-h-[300px]">
                  {cargando ? (
                    <div className="flex justify-center py-10"><Spinner size="md" /></div>
                  ) : pendientes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <span className="material-symbols-outlined text-[var(--color-success-emerald)] text-4xl mb-3">task_alt</span>
                      <p className="text-sm text-[var(--color-on-surface-variant)]/60">Sin pagos pendientes.</p>
                    </div>
                  ) : pendientes.slice(0, 5).map((t) => (
                    <div key={t.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{t.nombre_usuario ?? t.usuarioId}</p>
                          <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-0.5 truncate">
                            {t.nombre_plan ?? 'Plan'} · {new Date(t.fecha_solicitud).toLocaleDateString('es-CO')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {t.comprobante_url
                            ? <Badge variant="success">Con comprobante</Badge>
                            : <Badge variant="danger">Sin comprobante</Badge>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-white/5">
                  <Link href="/admin/finanzas">
                    <Button variant="ghost" size="sm" fullWidth>
                      Ver todas en Finanzas
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Button>
                  </Link>
                </div>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ── Accesos rápidos ── */}
        <Reveal delay={0.28}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Usuarios', icon: 'people', href: '/admin/usuarios' },
              { label: 'Finanzas', icon: 'account_balance', href: '/admin/finanzas' },
              { label: 'Planes', icon: 'workspace_premium', href: '/admin/planes' },
              { label: 'Clases', icon: 'pool', href: '/portal/clases' },
            ].map((a) => (
              <Link key={a.label} href={a.href}>
                <Card hover className="flex flex-col items-center gap-3 py-6 text-center cursor-pointer group">
                  <span className="material-symbols-outlined text-[28px] text-[var(--color-on-surface-variant)]/50 group-hover:text-[var(--color-primary-fixed)] transition-colors duration-200">
                    {a.icon}
                  </span>
                  <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/70 group-hover:text-white transition-colors duration-200">
                    {a.label}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
