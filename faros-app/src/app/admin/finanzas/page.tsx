'use client'

// ============================================================
// FAROS — Admin · Finanzas
// Requisitos (notas ④):
//  - Estadísticas de ingresos / egresos / registros / balance
//  - Aprobar (o rechazar) una nueva transacción a su programa
//  - Historial de movimientos
// Montos en pesos colombianos (COP).
// ============================================================

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import { ROSTER, describirPlan } from '@/lib/planes'

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

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

// ── Datos de ejemplo (se reemplazan por Firestore) ──
const INGRESOS_MES = 42_850_000
const EGRESOS_MES = 12_400_000
const BALANCE = INGRESOS_MES - EGRESOS_MES
const REGISTROS_MES = 38

const FLUJO = [
  { mes: 'ENE', ing: 62, egr: 28 }, { mes: 'FEB', ing: 74, egr: 34 },
  { mes: 'MAR', ing: 58, egr: 40 }, { mes: 'ABR', ing: 86, egr: 30 },
  { mes: 'MAY', ing: 78, egr: 45 }, { mes: 'JUN', ing: 91, egr: 38 },
]

type Transaccion = {
  id: string
  nombre: string
  programa: string
  monto: number
  metodo: string
  fecha: string
}

// Pagos pendientes de aprobar: cada uno corresponde al PLAN REAL del
// atleta en el roster, con la tarifa que calcula lib/planes.ts.
const PENDIENTES_INICIALES: Transaccion[] = ROSTER.slice(0, 3).map((a, i) => {
  const info = describirPlan(a.plan)
  return {
    id: `t${i + 1}`,
    nombre: a.nombre,
    programa: `${info.titulo} · ${info.frecuenciaLabel}`,
    monto: info.precioMensual,
    metodo: ['Nequi', 'Bancolombia', 'Daviplata'][i] ?? 'Nequi',
    fecha: ['Hoy · 08:12 AM', 'Hoy · 07:40 AM', 'Ayer · 06:20 PM'][i] ?? 'Hoy',
  }
})

const infoValentina = describirPlan(ROSTER[3].plan)
const infoMariana = describirPlan(ROSTER[5].plan)

const HISTORIAL: (Transaccion & { tipo: 'ingreso' | 'egreso'; estado: 'Aprobado' | 'Registrado' })[] = [
  { id: 'h1', nombre: ROSTER[3].nombre, programa: `${infoValentina.titulo} · ${infoValentina.frecuenciaLabel}`, monto: infoValentina.precioMensual, metodo: 'Nequi', fecha: '14 Jul', tipo: 'ingreso', estado: 'Aprobado' },
  { id: 'h2', nombre: 'Mantenimiento Piscina A', programa: 'Egreso operativo', monto: 1_800_000, metodo: 'Transferencia', fecha: '12 Jul', tipo: 'egreso', estado: 'Registrado' },
  { id: 'h3', nombre: ROSTER[5].nombre, programa: `${infoMariana.titulo} · ${infoMariana.frecuenciaLabel}`, monto: infoMariana.precioMensual, metodo: 'Bancolombia', fecha: '11 Jul', tipo: 'ingreso', estado: 'Aprobado' },
  { id: 'h4', nombre: 'Nómina entrenadores', programa: 'Egreso operativo', monto: 6_200_000, metodo: 'Transferencia', fecha: '05 Jul', tipo: 'egreso', estado: 'Registrado' },
]

function ini(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function FinanzasPage() {
  const { authorized, loading } = useRoleGuard(['admin'])
  const [pendientes, setPendientes] = useState(PENDIENTES_INICIALES)
  const maxFlujo = 100

  const kpis = useMemo(() => [
    { label: 'Ingresos del mes', value: COP.format(INGRESOS_MES), icon: 'trending_up', tone: 'success' as const, delta: '+12.5%' },
    { label: 'Egresos del mes', value: COP.format(EGRESOS_MES), icon: 'trending_down', tone: 'danger' as const, delta: '−3.2%' },
    { label: 'Balance neto', value: COP.format(BALANCE), icon: 'account_balance', tone: 'primary' as const },
    { label: 'Registros nuevos', value: String(REGISTROS_MES), icon: 'group_add', tone: 'primary' as const, sub: 'este mes' },
  ], [])

  function resolver(id: string) {
    setPendientes((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Finanzas">
      <div className="space-y-8">

        {/* ── Header ── */}
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Movimientos del club</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Finanzas
            </h2>
          </div>
        </Reveal>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((k, i) => (
            <Reveal key={k.label} delay={0.05 * i}>
              <Card className="h-full">
                <div className="flex justify-between items-start mb-6">
                  <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/70">{k.label}</span>
                  <span className={`material-symbols-outlined p-2 rounded-xl text-[20px] ${
                    k.tone === 'success' ? 'text-[var(--color-success-emerald)] bg-[rgba(16,185,129,0.1)]'
                    : k.tone === 'danger' ? 'text-[var(--color-danger-crimson)] bg-[rgba(239,68,68,0.1)]'
                    : 'text-[var(--color-primary-fixed)] bg-[rgba(230,255,0,0.1)]'
                  }`}>{k.icon}</span>
                </div>
                <p className="font-display text-2xl font-black text-white tracking-tighter leading-none">{k.value}</p>
                {k.delta && (
                  <p className={`text-[11px] font-bold mt-3 ${k.tone === 'success' ? 'text-[var(--color-success-emerald)]' : 'text-[var(--color-danger-crimson)]'}`}>
                    {k.delta} <span className="text-[var(--color-on-surface-variant)]/40 font-normal uppercase">vs. mes anterior</span>
                  </p>
                )}
                {k.sub && <p className="text-[10px] text-[var(--color-on-surface-variant)]/40 uppercase mt-3">{k.sub}</p>}
              </Card>
            </Reveal>
          ))}
        </div>

        {/* ── Flujo + Aprobaciones ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Flujo ingresos vs egresos */}
          <div className="lg:col-span-7">
            <Reveal delay={0.15}>
              <Card padding="none" className="overflow-hidden h-full">
                <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                  <h3 className="label-caps text-xs text-white">Ingresos vs egresos</h3>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2 label-caps text-[9px] text-[var(--color-on-surface-variant)]/60">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary-fixed)]" /> Ingresos
                    </span>
                    <span className="flex items-center gap-2 label-caps text-[9px] text-[var(--color-on-surface-variant)]/60">
                      <span className="w-2.5 h-2.5 rounded-full bg-white/25" /> Egresos
                    </span>
                  </div>
                </div>
                <div className="p-6 md:p-10 min-h-[300px] flex items-end justify-between gap-3 md:gap-5">
                  {FLUJO.map((f, i) => (
                    <div key={f.mes} className="flex-1 flex flex-col items-center gap-3">
                      <div className="w-full flex items-end justify-center gap-1.5 h-[220px]">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(f.ing / maxFlujo) * 100}%` }}
                          transition={{ duration: 0.7, delay: 0.05 * i, ease: EASE }}
                          className="w-1/2 max-w-[26px] rounded-t-lg bg-[var(--color-primary-fixed)] shadow-[0_0_12px_rgba(230,255,0,0.25)]"
                        />
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(f.egr / maxFlujo) * 100}%` }}
                          transition={{ duration: 0.7, delay: 0.08 * i, ease: EASE }}
                          className="w-1/2 max-w-[26px] rounded-t-lg bg-white/20"
                        />
                      </div>
                      <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/40">{f.mes}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
          </div>

          {/* Cola de aprobaciones */}
          <div className="lg:col-span-5">
            <Reveal delay={0.2}>
              <Card padding="none" className="overflow-hidden h-full flex flex-col">
                <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                  <h3 className="label-caps text-xs text-white">Transacciones por aprobar</h3>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${
                    pendientes.length > 0
                      ? 'bg-[var(--color-danger-crimson)] text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                      : 'bg-[rgba(16,185,129,0.15)] text-[var(--color-success-emerald)]'
                  }`}>
                    {pendientes.length > 0 ? `${pendientes.length} en cola` : 'Al día'}
                  </span>
                </div>
                <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[360px]">
                  {pendientes.map((t) => (
                    <div key={t.id} className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[11px] font-black text-white shrink-0">
                          {ini(t.nombre)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-white truncate">{t.nombre}</p>
                          <p className="text-[10px] text-[var(--color-on-surface-variant)]/50 uppercase tracking-wide truncate">{t.programa}</p>
                        </div>
                        <span className="font-display font-black text-[var(--color-primary-fixed)] shrink-0">{COP.format(t.monto)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">{t.metodo} · {t.fecha}</span>
                        {/* 44px y separados: son acciones de dinero, un
                            mis-tap aprueba lo que se quería rechazar. */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => resolver(t.id)}
                            aria-label={`Rechazar transacción de ${t.nombre}`}
                            className="w-11 h-11 flex items-center justify-center text-[var(--color-on-surface-variant)]/50 hover:text-[var(--color-danger-crimson)] hover:bg-[rgba(239,68,68,0.1)] rounded-xl transition-colors duration-200 active:scale-[0.94]"
                          >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                          </button>
                          <button
                            onClick={() => resolver(t.id)}
                            aria-label={`Aprobar transacción de ${t.nombre}`}
                            className="w-11 h-11 flex items-center justify-center text-[var(--color-primary-fixed)] bg-[rgba(230,255,0,0.05)] border border-[rgba(230,255,0,0.2)] hover:bg-[var(--color-primary-fixed)] hover:text-black rounded-xl transition-colors duration-200 active:scale-[0.94]"
                          >
                            <span className="material-symbols-outlined text-[20px]">check</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendientes.length === 0 && (
                    <div className="text-center py-12">
                      <span className="material-symbols-outlined text-[var(--color-success-emerald)] text-4xl mb-3 block">task_alt</span>
                      <p className="text-sm text-[var(--color-on-surface-variant)]/60">No hay transacciones pendientes.</p>
                    </div>
                  )}
                </div>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ── Historial ── */}
        <Reveal delay={0.24}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/10 bg-white/[0.02]">
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Historial de movimientos
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[680px]">
                <thead className="bg-white/5">
                  <tr>
                    {['Concepto', 'Programa', 'Método', 'Fecha', 'Monto', 'Estado'].map((h) => (
                      <th key={h} className={`px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 ${h === 'Monto' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {HISTORIAL.map((m) => (
                    <tr key={m.id} className="hover:bg-white/[0.03] transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            m.tipo === 'ingreso' ? 'bg-[rgba(16,185,129,0.1)]' : 'bg-[rgba(239,68,68,0.1)]'
                          }`}>
                            <span className={`material-symbols-outlined text-[18px] ${
                              m.tipo === 'ingreso' ? 'text-[var(--color-success-emerald)]' : 'text-[var(--color-danger-crimson)]'
                            }`}>{m.tipo === 'ingreso' ? 'south_west' : 'north_east'}</span>
                          </span>
                          <span className="text-sm text-white">{m.nombre}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-[var(--color-on-surface-variant)]/60">{m.programa}</td>
                      <td className="px-6 py-4 text-xs text-[var(--color-on-surface-variant)]/60">{m.metodo}</td>
                      <td className="px-6 py-4 text-xs text-[var(--color-on-surface-variant)]/60 whitespace-nowrap">{m.fecha}</td>
                      <td className={`px-6 py-4 text-right font-display font-black whitespace-nowrap ${
                        m.tipo === 'ingreso' ? 'text-[var(--color-success-emerald)]' : 'text-[var(--color-danger-crimson)]'
                      }`}>
                        {m.tipo === 'ingreso' ? '+' : '−'}{COP.format(m.monto)}
                      </td>
                      <td className="px-6 py-4"><Badge variant="default">{m.estado}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
