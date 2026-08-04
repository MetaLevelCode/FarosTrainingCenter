'use client'

// ============================================================
// FAROS — Alumno Dashboard
// Ported from Stitch "dashboard_alumno_magnet_edition".
// Toda la información deriva del PLAN CONTRATADO del alumno
// (lib/planes.ts): sesiones del mes, horarios, grupo y compañeros.
// ============================================================

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { ScrollVideoPanel } from '@/components/shared/ScrollVideoPanel'
import { BrandImageStrip } from '@/components/shared/BrandImageStrip'
import { Semanario } from '@/components/dashboard/Semanario'
import { MensajesAlumno } from '@/components/dashboard/MensajesAlumno'
import { ROSTER, describirPlan, pctAsistencia, ESTADO_LABEL } from '@/lib/planes'
import { esAlumnoCompleto, type Fase } from '@/lib/matricula'

const EASE = [0.22, 1, 0.36, 1] as const

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

// ── Velocity trend (semana a semana, % del objetivo) ──
const VELOCIDAD = [
  { semana: 'S1', pct: 40 }, { semana: 'S2', pct: 55 }, { semana: 'S3', pct: 45 },
  { semana: 'S4', pct: 70 }, { semana: 'S5', pct: 65 }, { semana: 'S6', pct: 91 },
]

export default function DashboardPage() {
  const { authorized, loading } = useRoleGuard(['alumno'])
  const { user, isMockMode } = useAuth()
  const firstName = user?.displayName?.split(' ')[0] ?? 'Atleta'

  // ── Todo se deriva del plan contratado ──
  const yo = useMemo(
    () => ROSTER.find((a) => a.nombre === user?.displayName) ?? ROSTER[0],
    [user?.displayName],
  )
  const plan = user?.planActivo ?? yo.plan
  const info = useMemo(() => describirPlan(plan), [plan])

  // ── Fase del alumno en el ciclo de matrícula ──
  // Fuente real: plan.estado. En modo demo se puede previsualizar cada
  // fase con el conmutador de abajo (se elimina al conectar Firestore).
  const [fase, setFase] = useState<Fase>(plan.estado)
  const alumnoCompleto = esAlumnoCompleto(fase)

  const asistidas = yo.asistidas
  const restantes = Math.max(0, info.sesionesMes - asistidas)
  const pctSesiones = info.sesionesMes ? Math.round((asistidas / info.sesionesMes) * 100) : 0

  // Compañeros del mismo grupo → ranking por % de asistencia de su plan
  const companeros = useMemo(() => {
    const mismos = plan.tipo === 'grupal'
      ? ROSTER.filter((a) => a.plan.tipo === 'grupal' && a.plan.grupoId === plan.grupoId)
      : ROSTER.filter((a) => a.entrenador === yo.entrenador)
    return [...mismos]
      .sort((a, b) => pctAsistencia(b) - pctAsistencia(a))
      .map((a, i) => ({ ...a, pos: i + 1, pct: pctAsistencia(a) }))
  }, [plan, yo.entrenador])


  return (
    <GuardedShell authorized={authorized} loading={loading} title="Dashboard">
      <div className="space-y-8">

        {/* ── Saludo breve ── */}
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-2 tracking-[0.2em]">
              {info.subtitulo}
            </p>
            <h2 className="font-display text-display-md text-white leading-none tracking-tighter uppercase">
              Hola, {firstName}
            </h2>
          </div>
        </Reveal>

        {/* ── Conmutador de fase (solo demo — se elimina con Firestore) ── */}
        {isMockMode && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3">
            <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mr-1">
              Demo · previsualizar fase
            </span>
            {(['pendiente', 'por_pagar', 'activo', 'vencido'] as Fase[]).map((f) => (
              <button
                key={f}
                onClick={() => setFase(f)}
                className={`px-3 py-1.5 rounded-full label-caps text-[9px] transition-colors ${
                  fase === f
                    ? 'bg-[var(--color-primary-fixed)] text-black'
                    : 'bg-white/5 text-[var(--color-on-surface-variant)]/60 hover:text-white'
                }`}
              >
                {ESTADO_LABEL[f]}
              </button>
            ))}
          </div>
        )}

        {/* ── Semanario — acción principal del alumno ── */}
        <Reveal delay={0.05}>
          <Semanario
            plan={plan}
            fase={fase}
            onPagar={() => setFase('activo')}
            onSolicitar={() => setFase('pendiente')}
          />
        </Reveal>

        {/* Estado del plan */}
        <Reveal delay={0.1}>
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <div className="flex flex-wrap gap-8">
                <div className="flex flex-col">
                  <span className="label-caps text-[var(--color-on-surface-variant)]/60 mb-1">Tu plan</span>
                  <span className="font-display text-headline-md font-extrabold text-white uppercase">
                    {info.titulo}
                  </span>
                </div>
                <div className="w-px h-10 bg-white/10 hidden sm:block" />
                <div className="flex flex-col">
                  <span className="label-caps text-[var(--color-on-surface-variant)]/60 mb-1">Frecuencia</span>
                  <span className="font-display text-headline-md font-extrabold text-white uppercase">
                    {plan.week}× / semana
                  </span>
                </div>
                <div className="w-px h-10 bg-white/10 hidden sm:block" />
                <div className="flex flex-col">
                  <span className="label-caps text-[var(--color-on-surface-variant)]/60 mb-1">Estado</span>
                  <span className={`flex items-center gap-2 font-display font-extrabold ${
                    fase === 'activo' ? 'text-[var(--color-success-emerald)]'
                    : fase === 'por_pagar' ? 'text-[var(--color-primary-fixed)]'
                    : fase === 'pendiente' ? 'text-amber-400'
                    : 'text-[var(--color-danger-crimson)]'
                  }`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      fase === 'activo' ? 'bg-[var(--color-success-emerald)] shadow-[0_0_10px_#10B981]'
                      : fase === 'por_pagar' ? 'bg-[var(--color-primary-fixed)] shadow-[0_0_10px_#e6ff00]'
                      : fase === 'pendiente' ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24]'
                      : 'bg-[var(--color-danger-crimson)] shadow-[0_0_10px_#ef4444]'
                    }`} />
                    {ESTADO_LABEL[fase]}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ── El rendimiento solo se abre para el alumno completo (activo) ── */}
        {alumnoCompleto ? (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Training plan */}
          <div className="lg:col-span-8 space-y-6">
            <Reveal delay={0.1}>
              <Card padding="lg">
                <div className="flex flex-wrap items-center gap-3 mb-8">
                  <Badge variant="primary">{info.tipoLabel}</Badge>
                  <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60">
                    {info.titulo}
                  </span>
                  {info.horarios.map((h) => (
                    <span key={h} className="label-caps text-[9px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[var(--color-on-surface-variant)]/70">
                      {h}
                    </span>
                  ))}
                </div>
                <h3 className="font-display text-headline-lg text-white mb-10 uppercase tracking-tighter">
                  Clase del Día
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <p className="label-caps text-[var(--color-primary-fixed)] border-b border-[rgba(230,255,0,0.2)] pb-2 inline-block">
                      Protocolo de sesión
                    </p>
                    <ul className="space-y-4">
                      {[
                        'Calentamiento: 400m libre ritmo mixto',
                        'Series: 8 × 50m sprints (90% intensidad)',
                        'Drills: 200m enfoque en patada',
                      ].map((item, i) => (
                        <li key={i} className="flex items-baseline gap-4 group">
                          <span className="text-[12px] font-black text-[rgba(230,255,0,0.5)] group-hover:text-[var(--color-primary-fixed)] transition-colors">
                            0{i + 1}
                          </span>
                          <span className="text-[var(--color-on-surface)]/70 group-hover:text-white transition-colors">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white/5 p-8 border border-white/5 rounded-2xl">
                    <p className="label-caps text-[var(--color-on-surface-variant)] mb-4 text-[10px]">Notas del coach</p>
                    <p className="text-[var(--color-on-surface)]/90 italic leading-relaxed">
                      &ldquo;{firstName}, prioriza el codo alto en la recuperación. Objetivo &lt; 32s en todos los intervalos de 50m.&rdquo;
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t border-white/5">
                  {[
                    { label: 'Ritmo objetivo', value: '1:24', unit: '/100m' },
                    { label: 'Distancia', value: '1,800m', unit: '' },
                    { label: 'Tiempo', value: '55 MIN', unit: '' },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <span className="block label-caps text-[var(--color-on-surface-variant)]/50 mb-2">{stat.label}</span>
                      <span className="block font-display text-headline-md font-extrabold text-[var(--color-primary-fixed)] uppercase tracking-tighter">
                        {stat.value}<span className="text-sm opacity-50">{stat.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>

            {/* Velocity trend */}
            <Reveal delay={0.18}>
              <Card padding="lg">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Tendencia de velocidad</h3>
                  <span className="label-caps text-[10px] text-[var(--color-primary-fixed)]/80">Fase actual · Semana 6</span>
                </div>
                <div className="h-44 flex items-end justify-between gap-3 md:gap-4">
                  {VELOCIDAD.map((v, i) => {
                    const actual = i === VELOCIDAD.length - 1
                    return (
                      <div key={v.semana} className="flex-1 flex flex-col items-center gap-3 h-full justify-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${v.pct}%` }}
                          transition={{ duration: 0.7, delay: 0.05 * i, ease: EASE }}
                          className={`w-full rounded-t-lg ${
                            actual
                              ? 'bg-[var(--color-primary-fixed)] shadow-[0_0_30px_rgba(230,255,0,0.3)]'
                              : 'bg-white/5 hover:bg-[rgba(230,255,0,0.2)] transition-colors duration-200'
                          }`}
                        />
                        <span className={`label-caps text-[9px] ${actual ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/60'}`}>
                          {v.semana}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </Reveal>
          </div>

          {/* Right column */}
          <div className="lg:col-span-4 space-y-6">
            <Reveal delay={0.2}>
              <Card>
                <div className="flex justify-between items-start mb-6">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Asistencia del mes</h3>
                  <span className="material-symbols-outlined text-[var(--color-success-emerald)] text-[24px]">check_circle</span>
                </div>
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="font-display text-display-lg font-black text-white leading-none">{asistidas}</span>
                  <span className="label-caps text-[var(--color-on-surface-variant)]/60">/ {info.sesionesMes} sesiones</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pctSesiones}%` }}
                    transition={{ duration: 0.8, ease: EASE }}
                    className="h-full bg-[var(--color-primary-fixed)] shadow-[0_0_15px_rgba(230,255,0,0.4)] rounded-full"
                  />
                </div>
                <p className="label-caps text-[11px] text-[var(--color-on-surface-variant)]/60">
                  {restantes > 0
                    ? `Te quedan ${restantes} de tu plan ${plan.week}×/semana`
                    : 'Completaste las sesiones del mes'}
                </p>
              </Card>
            </Reveal>

            <Reveal delay={0.3}>
              <Card>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Tu grupo</h3>
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">military_tech</span>
                </div>
                <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-6">
                  {info.titulo} · asistencia del mes
                </p>
                <div className="space-y-3">
                  {companeros.map((r) => {
                    const eresTu = r.id === yo.id
                    return (
                      <div
                        key={r.id}
                        className={`flex items-center gap-4 p-3 rounded-2xl transition-colors ${
                          eresTu
                            ? 'bg-[rgba(230,255,0,0.1)] border border-[rgba(230,255,0,0.2)]'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <span className={`font-black text-[12px] w-4 ${eresTu ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/30'}`}>
                          {String(r.pos).padStart(2, '0')}
                        </span>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                          eresTu ? 'bg-[var(--color-primary-fixed)] text-black' : 'bg-white/10 border border-white/10 text-white'
                        }`}>
                          {r.nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <span className={`flex-1 label-caps truncate ${eresTu ? 'text-white font-black' : 'text-[var(--color-on-surface-variant)]/70'}`}>
                          {eresTu ? `${firstName} (Tú)` : r.nombre}
                        </span>
                        <span className={`font-black ${eresTu ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/60'}`}>
                          {r.pct}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </Reveal>

            <Reveal delay={0.35}>
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Tu plan</h3>
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">workspace_premium</span>
                </div>

                <p className="font-display text-2xl font-black text-white uppercase tracking-tight leading-tight">
                  {info.titulo}
                </p>
                <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mt-2 mb-5">
                  {info.frecuenciaLabel} · {info.sesionesMes} sesiones/mes
                </p>

                {info.horarios.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {info.horarios.map((h) => (
                      <span key={h} className="label-caps text-[9px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[var(--color-on-surface-variant)]/70">
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between py-4 border-y border-white/5 mb-5">
                  <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">Mensualidad</span>
                  <span className="font-display font-black text-[var(--color-primary-fixed)]">{info.precioTexto}</span>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">Próximo pago</span>
                  <span className="text-sm text-white">{plan.proximoPago}</span>
                </div>

                <Link href="/dashboard/planes" className="block">
                  <Button variant="outline" size="md" fullWidth>Cambiar mi plan</Button>
                </Link>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ── Mensajes: muro de la clase + privado con el coach ── */}
        <Reveal delay={0.15}>
          <MensajesAlumno
            alumnoId={yo.id}
            alumnoNombre={yo.nombre}
            claseId={plan.grupoId ?? 'knowill'}
            claseNombre={info.titulo}
          />
        </Reveal>

        {/* ── Scroll-driven brand video reveal ── */}
        <Reveal delay={0.1}>
          <ScrollVideoPanel />
        </Reveal>

        {/* ── Brand image parallax strip ── */}
        <Reveal delay={0.15}>
          <div>
            <p className="label-caps text-[var(--color-on-surface-variant)]/50 mb-4">Identidad Faros</p>
            <BrandImageStrip />
          </div>
        </Reveal>
        </>
        ) : (
          <Reveal delay={0.15}>
            <BloqueoEstadisticas fase={fase} onPagar={() => setFase('activo')} />
          </Reveal>
        )}
      </div>
    </GuardedShell>
  )
}

// ── Panel bloqueado: lo que se abre al activar el plan ──
function BloqueoEstadisticas({ fase, onPagar }: { fase: Fase; onPagar: () => void }) {
  const bloqueadas = [
    { icon: 'pool', label: 'Clase del día' },
    { icon: 'timer', label: 'Tiempos y lapsos' },
    { icon: 'trending_up', label: 'Tendencia de velocidad' },
    { icon: 'leaderboard', label: 'Ranking de tu grupo' },
  ]
  return (
    <Card padding="lg" className="!rounded-[2.5rem] text-center">
      <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/40 text-5xl mb-4">lock</span>
      <h3 className="font-display text-headline-lg font-black text-white uppercase tracking-tighter mb-3">
        Tus estadísticas están en espera
      </h3>
      <p className="text-[var(--color-on-surface-variant)]/70 max-w-lg mx-auto mb-8">
        {fase === 'pendiente'
          ? 'Cuando el club confirme tu solicitud y actives tu plan con el pago, se abrirán tus estadísticas, tiempos y ranking.'
          : fase === 'por_pagar'
            ? 'Tu plan ya fue confirmado. Actívalo con el pago para desbloquear todo tu panel de rendimiento.'
            : 'Renueva tu plan para volver a ver tu rendimiento, tiempos y ranking.'}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto mb-8">
        {bloqueadas.map((b) => (
          <div key={b.label} className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/5 bg-white/[0.02] opacity-60">
            <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/50 text-[26px]">{b.icon}</span>
            <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">{b.label}</span>
          </div>
        ))}
      </div>

      {fase === 'por_pagar' ? (
        <Button size="lg" onClick={onPagar}>Pagar y activar plan</Button>
      ) : fase === 'vencido' ? (
        <Link href="/dashboard/planes"><Button size="lg">Renovar plan</Button></Link>
      ) : (
        <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/40">
          Te avisaremos cuando tu solicitud esté lista
        </p>
      )}
    </Card>
  )
}
