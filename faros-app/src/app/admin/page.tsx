'use client'

// ============================================================
// FAROS — Panel Admin
// Ported from Stitch "panel_admin_refined_magnet_edition_v2":
// KPIs financieros + performance stream + cola de aprobaciones
// + directorio global de usuarios.
// ============================================================

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'

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

// ── Datos de ejemplo (se reemplazan por Firestore) ──
const KPIS = [
  {
    label: 'Ingresos netos', value: '$42,850', icon: 'trending_up', tone: 'success' as const,
    delta: '+12.5%', deltaLabel: 'vs. mes anterior',
  },
  {
    label: 'Egresos operativos', value: '$12,400', icon: 'trending_down', tone: 'danger' as const,
    delta: '−3.2%', deltaLabel: 'vs. mes anterior',
  },
  {
    label: 'Atletas activos', value: '1,204', icon: 'shield_person', tone: 'primary' as const,
    progress: 82,
  },
  {
    label: 'Ocupación de piscinas', value: '88%', icon: 'pool', tone: 'primary' as const,
    pulse: 'CAPACIDAD PICO',
  },
]

const STREAM_30D = [
  { mes: 'ENE', pct: 38 }, { mes: 'FEB', pct: 55 }, { mes: 'MAR', pct: 74 },
  { mes: 'ABR', pct: 47 }, { mes: 'MAY', pct: 86 }, { mes: 'JUN', pct: 64 },
]
const STREAM_7D = [
  { mes: 'LUN', pct: 52 }, { mes: 'MAR', pct: 68 }, { mes: 'MIÉ', pct: 44 },
  { mes: 'JUE', pct: 78 }, { mes: 'VIE', pct: 91 }, { mes: 'SÁB', pct: 60 },
]

const APROBACIONES_INICIALES = [
  { id: 1, titulo: 'Protocolo de Fuerza v2.4', detalle: 'Macro-ciclo A • Activo', coach: 'Coach Marcos', prioridad: true },
  { id: 2, titulo: 'Plan Resistencia Juvenil', detalle: 'Micro-ciclo 3 • Borrador', coach: 'Coach Ana', prioridad: false },
  { id: 3, titulo: 'Rutina Aquafitness Adultos', detalle: 'Ciclo mensual • Activo', coach: 'Coach Felipe', prioridad: false },
  { id: 4, titulo: 'Preparación Torneo Regional', detalle: 'Macro-ciclo B • Urgente', coach: 'Coach Marcos', prioridad: true },
]

type Filtro = 'todos' | 'atletas' | 'staff'

const USUARIOS = [
  { nombre: 'Rafael Solano', rol: 'Atleta Pro • Tier 1', tipo: 'atletas', estado: 'Activo', asistencia: 98, standing: 'Campeón' },
  { nombre: 'Camila Herrera', rol: 'Atleta • Tier 2', tipo: 'atletas', estado: 'Activo', asistencia: 87, standing: 'Avanzado' },
  { nombre: 'Ana Torres', rol: 'Entrenadora principal', tipo: 'staff', estado: 'Activo', asistencia: 95, standing: 'Staff' },
  { nombre: 'Julián Ospina', rol: 'Atleta • Tier 3', tipo: 'atletas', estado: 'Suspendido', asistencia: 41, standing: 'En riesgo' },
  { nombre: 'Felipe Cárdenas', rol: 'Entrenador auxiliar', tipo: 'staff', estado: 'Activo', asistencia: 92, standing: 'Staff' },
]

function iniciales(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function AdminPage() {
  const { authorized, loading } = useRoleGuard(['admin'])
  const [rango, setRango] = useState<'7D' | '30D'>('30D')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [aprobaciones, setAprobaciones] = useState(APROBACIONES_INICIALES)

  const stream = rango === '30D' ? STREAM_30D : STREAM_7D
  const usuariosVisibles = useMemo(
    () => (filtro === 'todos' ? USUARIOS : USUARIOS.filter((u) => u.tipo === filtro)),
    [filtro],
  )

  function resolver(id: number) {
    setAprobaciones((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Admin Console">
      <div className="space-y-8">

        {/* ── Header ── */}
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Torre de Control</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Panel Admin
            </h2>
          </div>
        </Reveal>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {KPIS.map((kpi, i) => (
            <Reveal key={kpi.label} delay={0.05 * i}>
              <Card className="h-full">
                <div className="flex justify-between items-start mb-6">
                  <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/70">{kpi.label}</span>
                  <span
                    className={`material-symbols-outlined p-2 rounded-xl text-[20px] ${
                      kpi.tone === 'success'
                        ? 'text-[var(--color-success-emerald)] bg-[rgba(16,185,129,0.1)]'
                        : kpi.tone === 'danger'
                          ? 'text-[var(--color-danger-crimson)] bg-[rgba(239,68,68,0.1)]'
                          : 'text-[var(--color-primary-fixed)] bg-[rgba(230,255,0,0.1)]'
                    }`}
                  >
                    {kpi.icon}
                  </span>
                </div>
                <p className="text-[32px] font-black text-white tracking-tighter leading-none font-display">{kpi.value}</p>
                {kpi.delta && (
                  <div className="flex items-center gap-2 mt-3">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        kpi.tone === 'success'
                          ? 'text-[var(--color-success-emerald)] bg-[rgba(16,185,129,0.06)]'
                          : 'text-[var(--color-danger-crimson)] bg-[rgba(239,68,68,0.06)]'
                      }`}
                    >
                      {kpi.delta}
                    </span>
                    <span className="text-[10px] text-[var(--color-on-surface-variant)]/60 uppercase">{kpi.deltaLabel}</span>
                  </div>
                )}
                {kpi.progress !== undefined && (
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-5">
                    <div
                      className="bg-[var(--color-primary-fixed)] h-full shadow-[0_0_12px_rgba(230,255,0,0.4)] rounded-full"
                      style={{ width: `${kpi.progress}%` }}
                    />
                  </div>
                )}
                {kpi.pulse && (
                  <p className="text-[11px] text-[var(--color-on-surface-variant)]/50 mt-3 tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-fixed)] animate-pulse" />
                    {kpi.pulse}
                  </p>
                )}
              </Card>
            </Reveal>
          ))}
        </div>

        {/* ── Performance stream + aprobaciones ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <Reveal delay={0.15}>
              <Card padding="none" className="overflow-hidden h-full">
                <div className="p-6 md:p-8 border-b border-white/5 flex flex-wrap justify-between items-center gap-4 bg-white/[0.01]">
                  <div className="flex items-center gap-4">
                    <span className="w-3 h-3 rounded-full bg-[var(--color-primary-fixed)] shadow-[0_0_10px_#e6ff00]" />
                    <h3 className="label-caps text-xs text-white">Flujo de Ingresos</h3>
                  </div>
                  <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl" role="group" aria-label="Rango de tiempo">
                    {(['7D', '30D'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRango(r)}
                        aria-pressed={rango === r}
                        className={`px-5 py-2 text-[10px] font-black rounded-lg uppercase tracking-widest transition-colors duration-200 ${
                          rango === r
                            ? 'bg-[var(--color-primary-fixed)] text-black shadow-[0_0_15px_rgba(230,255,0,0.2)]'
                            : 'text-white/40 hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-6 md:p-10 min-h-[320px] flex items-end justify-between gap-3 md:gap-6 relative">
                  <div className="absolute inset-x-6 md:inset-x-10 inset-y-10 flex flex-col justify-between pointer-events-none opacity-5" aria-hidden="true">
                    {[0, 1, 2, 3].map((n) => <div key={n} className="w-full border-t border-white" />)}
                  </div>
                  {stream.map((bar, i) => (
                    <div key={bar.mes} className="flex-1 flex flex-col items-center group relative z-10">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${bar.pct * 2.6}px` }}
                        transition={{ duration: 0.7, delay: 0.05 * i, ease: EASE }}
                        className="w-full max-w-[54px] rounded-xl group-hover:brightness-125 transition-[filter] duration-200"
                        style={{
                          background: 'linear-gradient(to top, rgba(230,255,0,0.1), #e6ff00)',
                          boxShadow: '0 0 15px rgba(230,255,0,0.2)',
                        }}
                      />
                      <span className="mt-5 text-[10px] font-black uppercase text-[var(--color-on-surface-variant)]/60 tracking-[0.2em]">
                        {bar.mes}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
          </div>

          <div className="lg:col-span-4">
            <Reveal delay={0.2}>
              <Card padding="none" className="overflow-hidden h-full flex flex-col">
                <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                  <h3 className="label-caps text-xs text-white">Aprobaciones</h3>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${
                    aprobaciones.length > 0
                      ? 'bg-[var(--color-danger-crimson)] text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                      : 'bg-[rgba(16,185,129,0.15)] text-[var(--color-success-emerald)]'
                  }`}>
                    {aprobaciones.length > 0 ? `${aprobaciones.length} en cola` : 'Al día'}
                  </span>
                </div>
                <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[400px]">
                  {aprobaciones.map((a) => (
                    <div
                      key={a.id}
                      className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-[rgba(230,255,0,0.3)] hover:bg-white/[0.04] transition-[border-color,background-color] duration-300"
                    >
                      <div className="flex justify-between items-start mb-4 gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-black text-white mb-1 truncate">{a.titulo}</p>
                          <p className="text-[9px] text-[var(--color-on-surface-variant)]/50 uppercase tracking-widest font-bold">{a.detalle}</p>
                        </div>
                        {a.prioridad && (
                          <span className="text-[9px] font-black text-[var(--color-primary-fixed)] bg-[rgba(230,255,0,0.1)] px-2 py-1 rounded border border-[rgba(230,255,0,0.2)] shrink-0">
                            PRIORIDAD
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black text-[var(--color-on-surface-variant)] border border-white/5 shrink-0">
                            {iniciales(a.coach)}
                          </span>
                          <span className="text-xs text-[var(--color-on-surface-variant)]/80 font-bold truncate">{a.coach}</span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => resolver(a.id)}
                            aria-label={`Rechazar ${a.titulo}`}
                            className="w-9 h-9 flex items-center justify-center text-[var(--color-on-surface-variant)]/60 hover:text-[var(--color-danger-crimson)] hover:bg-[rgba(239,68,68,0.1)] rounded-xl transition-colors duration-200 active:scale-[0.94]"
                          >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                          </button>
                          <button
                            onClick={() => resolver(a.id)}
                            aria-label={`Aprobar ${a.titulo}`}
                            className="w-9 h-9 flex items-center justify-center text-[var(--color-primary-fixed)] bg-[rgba(230,255,0,0.05)] border border-[rgba(230,255,0,0.2)] hover:bg-[var(--color-primary-fixed)] hover:text-black rounded-xl transition-colors duration-200 active:scale-[0.94]"
                          >
                            <span className="material-symbols-outlined text-[20px]">check</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {aprobaciones.length === 0 && (
                    <div className="text-center py-12">
                      <span className="material-symbols-outlined text-[var(--color-success-emerald)] text-4xl mb-3 block">task_alt</span>
                      <p className="text-sm text-[var(--color-on-surface-variant)]/60">No hay planes pendientes de revisión.</p>
                    </div>
                  )}
                </div>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ── Directorio de usuarios ── */}
        <Reveal delay={0.25}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white/[0.01]">
              <div>
                <h3 className="label-caps text-xs text-white mb-2">Directorio Global de Usuarios</h3>
                <p className="text-[11px] text-[var(--color-on-surface-variant)]/50">
                  Gestión de credenciales de atletas y personal técnico.
                </p>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="relative">
                  <select
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value as Filtro)}
                    aria-label="Filtrar usuarios"
                    className="bg-black/30 border border-white/10 text-[11px] font-black rounded-xl py-3 pl-4 pr-10 text-[var(--color-on-surface-variant)]/70 uppercase tracking-widest appearance-none outline-none cursor-pointer hover:border-white/20 focus:border-[rgba(230,255,0,0.5)] transition-colors duration-200"
                  >
                    <option value="todos">Todos</option>
                    <option value="atletas">Atletas</option>
                    <option value="staff">Staff técnico</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none opacity-50">
                    expand_more
                  </span>
                </div>
                <Button size="sm">
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  Registrar
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01]">
                    {['Usuario', 'Estado', 'Asistencia', 'Standing', ''].map((h) => (
                      <th key={h} className="px-6 md:px-8 py-5 label-caps text-[9px] text-[var(--color-on-surface-variant)]/60">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-[14px]">
                  {usuariosVisibles.map((u) => {
                    const activo = u.estado === 'Activo'
                    return (
                      <tr key={u.nombre} className="hover:bg-white/[0.03] transition-colors duration-200 border-b border-white/5 group">
                        <td className="px-6 md:px-8 py-5">
                          <div className="flex items-center gap-4">
                            <span className="w-11 h-11 rounded-2xl border-2 border-[rgba(230,255,0,0.4)] group-hover:border-[var(--color-primary-fixed)] transition-colors duration-200 flex items-center justify-center text-[12px] font-black text-white bg-white/5 shrink-0">
                              {iniciales(u.nombre)}
                            </span>
                            <div>
                              <p className="font-black text-white text-[15px]">{u.nombre}</p>
                              <p className="text-[10px] text-[var(--color-on-surface-variant)]/60 uppercase tracking-widest font-bold mt-0.5">
                                {u.rol}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 md:px-8 py-5">
                          <Badge variant={activo ? 'success' : 'danger'}>{u.estado}</Badge>
                        </td>
                        <td className="px-6 md:px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="flex-1 min-w-[100px] h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  u.asistencia >= 80
                                    ? 'bg-[var(--color-success-emerald)] shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                    : u.asistencia >= 60
                                      ? 'bg-[var(--color-primary-fixed)] shadow-[0_0_10px_rgba(230,255,0,0.3)]'
                                      : 'bg-[var(--color-danger-crimson)] shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                                }`}
                                style={{ width: `${u.asistencia}%` }}
                              />
                            </div>
                            <span className="text-white text-xs font-black">{u.asistencia}%</span>
                          </div>
                        </td>
                        <td className="px-6 md:px-8 py-5">
                          <Badge variant={u.standing === 'Campeón' ? 'primary' : u.standing === 'En riesgo' ? 'danger' : 'default'}>
                            {u.standing}
                          </Badge>
                        </td>
                        <td className="px-6 md:px-8 py-5 text-right">
                          <button
                            aria-label={`Ver detalles de ${u.nombre}`}
                            className="text-[var(--color-on-surface-variant)]/30 hover:text-white hover:bg-white/5 p-2 rounded-lg transition-colors duration-200"
                          >
                            <span className="material-symbols-outlined">page_info</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
