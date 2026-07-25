'use client'

// ============================================================
// FAROS — Alumno · Asistencia
// Requisitos (notas ② Usuarios):
//  - Nº de asistencias y lo que le queda del ciclo
//  - Tiempos y lapsos registrados por sesión
//  - Clases grupales: quiénes van + opción de cancelar
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
const CICLO = { asistidas: 12, total: 20 }

const ULTIMA_SESION = {
  fecha: 'Ayer · 06:00 AM',
  clase: 'Velocidad · Piscina B',
  distancia: '1,800 m',
  laps: [
    { serie: '50m #1', tiempo: '0:31.8', ritmo: 63 },
    { serie: '50m #2', tiempo: '0:32.1', ritmo: 62 },
    { serie: '50m #3', tiempo: '0:31.2', ritmo: 64 },
    { serie: '50m #4', tiempo: '0:30.9', ritmo: 65 },
    { serie: '50m #5', tiempo: '0:32.4', ritmo: 61 },
    { serie: '50m #6', tiempo: '0:33.0', ritmo: 60 },
  ],
}

const HISTORIAL = [
  { fecha: '15 JUL', clase: 'Técnica de Mariposa', tipo: 'Grupal', distancia: '1,400 m', mejor: '0:34.2', estado: 'asistio' as const },
  { fecha: '13 JUL', clase: 'Resistencia Aeróbica', tipo: 'Grupal', distancia: '2,200 m', mejor: '0:35.8', estado: 'asistio' as const },
  { fecha: '11 JUL', clase: 'Velocidad · Personal', tipo: 'Personal', distancia: '1,600 m', mejor: '0:31.0', estado: 'asistio' as const },
  { fecha: '09 JUL', clase: 'Técnica de Crol', tipo: 'Grupal', distancia: '—', mejor: '—', estado: 'falto' as const },
  { fecha: '07 JUL', clase: 'Resistencia Aeróbica', tipo: 'Grupal', distancia: '2,000 m', mejor: '0:36.1', estado: 'asistio' as const },
]

const PROXIMAS_INICIALES = [
  {
    id: 'c1', dia: 'MAR 18', hora: '06:00 AM', clase: 'Endurance Squad', piscina: 'Piscina A',
    companeros: ['Carlos M.', 'Sofía R.', 'Diego M.', 'Andrea R.', 'Luis T.'], cancelada: false,
  },
  {
    id: 'c2', dia: 'JUE 20', hora: '05:30 PM', clase: 'Sprint Técnico', piscina: 'Piscina B',
    companeros: ['Valentina C.', 'Andrés R.', 'Mariana D.'], cancelada: false,
  },
]

function ini(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function AsistenciaPage() {
  const { authorized, loading } = useRoleGuard(['alumno'])
  const [proximas, setProximas] = useState(PROXIMAS_INICIALES)
  const restantes = CICLO.total - CICLO.asistidas
  const pct = Math.round((CICLO.asistidas / CICLO.total) * 100)

  const asistidasReales = useMemo(
    () => HISTORIAL.filter((h) => h.estado === 'asistio').length,
    [],
  )

  function cancelar(id: string) {
    setProximas((prev) => prev.map((c) => (c.id === id ? { ...c, cancelada: true } : c)))
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Asistencia">
      <div className="space-y-8">

        {/* ── Header ── */}
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Tu ciclo actual</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Asistencia
            </h2>
          </div>
        </Reveal>

        {/* ── Resumen del ciclo ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <Reveal delay={0.06}>
              <Card padding="lg" className="h-full">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Progreso del ciclo</h3>
                  <span className="material-symbols-outlined text-[var(--color-success-emerald)]">check_circle</span>
                </div>
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="font-display text-display-lg font-black text-white leading-none">{CICLO.asistidas}</span>
                  <span className="label-caps text-[var(--color-on-surface-variant)]/50">/ {CICLO.total} sesiones</span>
                </div>
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden mb-4">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: EASE }}
                    className="h-full bg-[var(--color-primary-fixed)] rounded-full shadow-[0_0_15px_rgba(230,255,0,0.4)]"
                  />
                </div>
                <p className="label-caps text-[11px] text-[var(--color-on-surface-variant)]/60">
                  Te quedan {restantes} sesiones para completar el ciclo
                </p>
              </Card>
            </Reveal>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Racha actual', value: '4', unit: 'seguidas', icon: 'local_fire_department' },
              { label: 'Mejor 50 m', value: '0:30.9', unit: '', icon: 'bolt' },
              { label: 'Ritmo medio', value: '62%', unit: 'objetivo', icon: 'speed' },
              { label: 'Confirmadas', value: String(asistidasReales), unit: 'este mes', icon: 'event_available' },
              { label: 'Faltas', value: '1', unit: 'este mes', icon: 'event_busy' },
              { label: 'Distancia', value: '9.2 km', unit: 'nadados', icon: 'pool' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={0.1 + i * 0.04}>
                <Card className="h-full">
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-[22px] mb-3">{s.icon}</span>
                  <p className="font-display text-xl font-black text-white leading-none tracking-tight">{s.value}</p>
                  <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-2">{s.label}</p>
                  {s.unit && <p className="text-[10px] text-[var(--color-on-surface-variant)]/40 mt-0.5">{s.unit}</p>}
                </Card>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ── Última sesión: tiempos y lapsos ── */}
        <Reveal delay={0.16}>
          <Card padding="lg">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                  Tiempos y lapsos
                </h3>
                <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-2">
                  {ULTIMA_SESION.fecha} · {ULTIMA_SESION.clase}
                </p>
              </div>
              <Badge variant="primary">{ULTIMA_SESION.distancia}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {ULTIMA_SESION.laps.map((lap, i) => (
                <div
                  key={lap.serie}
                  className="p-4 rounded-2xl border border-white/5 bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">{lap.serie}</span>
                    <span className="font-display font-black text-[var(--color-primary-fixed)]">{lap.tiempo}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${lap.ritmo}%` }}
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.05, ease: EASE }}
                      className="h-full bg-[var(--color-primary-fixed)]/70 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        {/* ── Historial ── */}
        <Reveal delay={0.2}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/10 bg-white/[0.02]">
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Historial de sesiones
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[560px]">
                <thead className="bg-white/5">
                  <tr>
                    {['Fecha', 'Clase', 'Tipo', 'Distancia', 'Mejor', 'Estado'].map((h) => (
                      <th key={h} className="px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {HISTORIAL.map((h) => (
                    <tr key={h.fecha} className="hover:bg-white/[0.03] transition-colors duration-200">
                      <td className="px-6 py-5 font-display font-black text-white text-sm whitespace-nowrap">{h.fecha}</td>
                      <td className="px-6 py-5 text-sm text-[var(--color-on-surface)]">{h.clase}</td>
                      <td className="px-6 py-5"><Badge variant={h.tipo === 'Personal' ? 'primary' : 'default'}>{h.tipo}</Badge></td>
                      <td className="px-6 py-5 text-sm text-[var(--color-on-surface-variant)]/70 whitespace-nowrap">{h.distancia}</td>
                      <td className="px-6 py-5 font-display font-black text-[var(--color-primary-fixed)] text-sm whitespace-nowrap">{h.mejor}</td>
                      <td className="px-6 py-5">
                        {h.estado === 'asistio'
                          ? <Badge variant="success">Asistió</Badge>
                          : <Badge variant="danger">Faltó</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>

        {/* ── Próximas clases grupales ── */}
        <Reveal delay={0.24}>
          <div>
            <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-5">
              Próximas clases grupales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {proximas.map((c) => (
                <Card key={c.id} className={c.cancelada ? 'opacity-60' : ''}>
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black text-[var(--color-on-surface-variant)]">
                          {c.dia}
                        </span>
                        {c.cancelada && <Badge variant="danger">Cancelada</Badge>}
                      </div>
                      <h4 className="font-display text-lg font-extrabold text-white uppercase tracking-tight">{c.clase}</h4>
                      <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1">
                        {c.hora} · {c.piscina}
                      </p>
                    </div>
                  </div>

                  <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-3">
                    Van contigo · {c.companeros.length}
                  </p>
                  <div className="flex items-center mb-6">
                    <div className="flex -space-x-2">
                      {c.companeros.slice(0, 5).map((n) => (
                        <span
                          key={n}
                          title={n}
                          className="w-9 h-9 rounded-full bg-white/10 border-2 border-[#0a0a0a] flex items-center justify-center text-[10px] font-black text-white"
                        >
                          {ini(n)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant={c.cancelada ? 'ghost' : 'outline'}
                    size="sm"
                    fullWidth
                    disabled={c.cancelada}
                    onClick={() => cancelar(c.id)}
                  >
                    {c.cancelada ? 'Cancelaste esta clase' : 'Cancelar asistencia'}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
