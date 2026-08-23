'use client'

// ============================================================
// FAROS — Estudiante Dashboard
// Información derivada de usuario.suscripcionActiva y estadísticas
// guardadas en Firestore.
// ============================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button, Spinner } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { getFirebase } from '@/lib/firebase'
import { getTransaccionesUsuario } from '@/lib/firestore'
import { ScrollVideoPanel } from '@/components/shared/ScrollVideoPanel'
import { BrandImageStrip } from '@/components/shared/BrandImageStrip'
import type { Transaccion, Clase } from '@/lib/types'
import { Semanario } from '@/components/dashboard/Semanario'
import { MensajesAlumno } from '@/components/dashboard/MensajesAlumno'
import { faseDeSuscripcion, cuposDisponibles, parseVencimiento } from '@/lib/matricula'

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

const VELOCIDAD = [
  { semana: 'S1', pct: 40 }, { semana: 'S2', pct: 55 }, { semana: 'S3', pct: 45 },
  { semana: 'S4', pct: 70 }, { semana: 'S5', pct: 65 }, { semana: 'S6', pct: 91 },
]

type Companero = { uid: string; nombre: string; tasa: number; pos: number; esYo: boolean }

export default function DashboardPage() {
  const { authorized, loading } = useRoleGuard(['estudiante'])
  const { user } = useAuth()
  const firstName = user?.nombres ?? 'Atleta'
  const [companeros, setCompaneros] = useState<Companero[]>([])
  const [txPendiente, setTxPendiente] = useState<Transaccion | null>(null)
  const [txCargada, setTxCargada] = useState(false)
  const [claseHoy, setClaseHoy] = useState<Clase | null>(null)
  const [claseHoyCargada, setClaseHoyCargada] = useState(false)
  const [diasSemana, setDiasSemana] = useState<number[]>([])
  const [horaSemana, setHoraSemana] = useState<string>('6:00 PM')

  const susc = user?.suscripcionActiva
  // tasaAsistencia se guarda como fracción (0-1) — a porcentaje para mostrar.
  const tasa = Math.round((user?.estadisticas?.tasaAsistencia ?? 0) * 100)
  const asistidas = user?.estadisticas?.clasesAsistidas ?? 0

  // Fase del ciclo de matrícula, derivada de la suscripción + transacción pendiente.
  // Solo se calcula cuando la tx ya fue consultada (txCargada) para evitar
  // mostrar 'vencido' durante la carga y luego saltar a 'pendiente'.
  const fase = txCargada ? faseDeSuscripcion(susc, txPendiente) : null
  const vencimientoDate = parseVencimiento(susc?.fechaVencimiento)
  const vencimiento = vencimientoDate
    ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(vencimientoDate)
    : undefined

  useEffect(() => {
    if (!user?.uid) return
    getTransaccionesUsuario(user.uid)
      .then((txs) => {
        const pendiente = txs.find((t) => t.estado === 'pendiente')
        if (pendiente) setTxPendiente(pendiente)
      })
      .catch(() => {})
      .finally(() => setTxCargada(true))
  }, [user?.uid])

  // "Clase del Día" (protocolo de sesión, notas del coach) vivía 100%
  // hardcodeada, sin ninguna relación con las clases reales del alumno
  // (reportado en QA manual) — se busca su clase inscrita de hoy y se
  // muestra el plan real que subió el profesor (o el aviso de que aún
  // no lo sube), en vez de datos de ejemplo.
  useEffect(() => {
    if (!user?.uid) return
    ;(async () => {
      try {
        const [{ db }, { collection, query, where, getDocs }] = await Promise.all([
          getFirebase(), import('firebase/firestore'),
        ])
        const snap = await getDocs(
          query(
            collection(db, 'clases'),
            where('estudiantes_inscritos', 'array-contains', user.uid),
            where('estado', 'in', ['programada', 'en_curso']),
          ),
        )
        const todas = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Clase)
          .sort((a, b) => a.fecha_hora_inicio - b.fecha_hora_inicio)

        const hoy = new Date()
        const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()
        const finDia = inicioDia + 24 * 60 * 60 * 1000
        const deHoy = todas.filter((c) => c.fecha_hora_inicio >= inicioDia && c.fecha_hora_inicio < finDia)
        setClaseHoy(deHoy[0] ?? null)

        // "Tu semana" (Semanario) mostraba siempre los 6 días en gris —
        // no recibía diasIniciales/horaInicial de ningún lado (reportado
        // en QA manual). El plan del wizard solo guarda la FRECUENCIA
        // (cuántos días/semana), no cuáles — así que se derivan de las
        // clases en las que el alumno ya está inscrito de verdad.
        const futuras = todas.filter((c) => c.fecha_hora_inicio > Date.now())
        setDiasSemana([...new Set(futuras.map((c) => new Date(c.fecha_hora_inicio).getDay()))])
        if (futuras[0]) {
          setHoraSemana(new Date(futuras[0].fecha_hora_inicio).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setClaseHoyCargada(true)
      }
    })()
  }, [user?.uid])

  useEffect(() => {
    if (!user?.sede) return
    ;(async () => {
      try {
        const [{ db }, { collection, query, where, getDocs }] = await Promise.all([
          getFirebase(), import('firebase/firestore'),
        ])
        const snap = await getDocs(
          query(collection(db, 'usuarios'), where('rol', '==', 'estudiante'), where('sede', '==', user.sede)),
        )
        const lista: Companero[] = snap.docs
          .map((d) => {
            const u = d.data()
            return {
              uid: d.id,
              nombre: `${u.nombres} ${u.apellidos}`,
              // tasaAsistencia se guarda como fracción (0-1) — a porcentaje para mostrar.
              tasa: Math.round((u.estadisticas?.tasaAsistencia ?? 0) * 100),
              pos: 0,
              esYo: d.id === user.uid,
            }
          })
          .sort((a, b) => b.tasa - a.tasa)
          .map((c, i) => ({ ...c, pos: i + 1 }))
        setCompaneros(lista)
      } catch {}
    })()
  }, [user?.uid, user?.sede])


  return (
    <GuardedShell authorized={authorized} loading={loading} title="Dashboard">
      <div className="space-y-8">

        {/* Hero */}
        <Reveal>
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <p className="label-caps text-[var(--color-primary-fixed)] mb-4 tracking-[0.2em]">
                {susc ? susc.nombrePlan : 'Sin plan activo'}
              </p>
              <h2 className="font-display text-display-lg text-white mb-6 leading-none tracking-tighter uppercase">
                Hola,<br />{firstName}
              </h2>
              <div className="flex flex-wrap gap-8">
                <div className="flex flex-col">
                  <span className="label-caps text-[var(--color-on-surface-variant)]/60 mb-1">Plan</span>
                  <span className="font-display text-headline-md font-extrabold text-white uppercase">
                    {susc?.nombrePlan ?? '—'}
                  </span>
                </div>
                {susc && (
                  <>
                    <div className="w-px h-10 bg-white/10 hidden sm:block" />
                    <div className="flex flex-col">
                      <span className="label-caps text-[var(--color-on-surface-variant)]/60 mb-1">Sesiones restantes</span>
                      <span className="font-display text-headline-md font-extrabold text-white uppercase">
                        {susc.sesionesRestantes}
                      </span>
                    </div>
                    <div className="w-px h-10 bg-white/10 hidden sm:block" />
                    <div className="flex flex-col">
                      <span className="label-caps text-[var(--color-on-surface-variant)]/60 mb-1">Estado</span>
                      <span className={`flex items-center gap-2 font-display font-extrabold ${
                        susc.estado === 'activa' ? 'text-[var(--color-success-emerald)]' : 'text-[var(--color-danger-crimson)]'
                      }`}>
                        <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] ${
                          susc.estado === 'activa' ? 'bg-[var(--color-success-emerald)]' : 'bg-[var(--color-danger-crimson)]'
                        }`} />
                        {susc.estado === 'activa' ? 'Activo' : 'Vencido'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </Reveal>

        {/* Banner de transacción pendiente */}
        {txPendiente && (
          <Reveal delay={0.05}>
            <Link
              href="/dashboard/planes"
              className={`block rounded-2xl border p-5 transition-colors duration-200 ${
                txPendiente.comprobante_url
                  ? 'border-white/15 bg-white/[0.03] hover:border-white/25'
                  : 'border-[rgba(230,255,0,0.3)] bg-[rgba(230,255,0,0.05)] hover:bg-[rgba(230,255,0,0.08)]'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`material-symbols-outlined text-[24px] ${
                  txPendiente.comprobante_url
                    ? 'text-[var(--color-on-surface-variant)]/50'
                    : 'text-[var(--color-primary-fixed)]'
                }`}>
                  {txPendiente.comprobante_url ? 'pending_actions' : 'upload_file'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black text-white text-sm">
                    {txPendiente.comprobante_url ? 'Pago en revisión' : 'Falta el comprobante de pago'}
                  </p>
                  <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mt-0.5 truncate">
                    {txPendiente.nombre_plan ?? 'Plan solicitado'} ·{' '}
                    {txPendiente.comprobante_url
                      ? 'Administración lo está revisando.'
                      : 'Súbelo para que activen tu plan.'}
                  </p>
                </div>
                <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/40 text-[20px] shrink-0">
                  chevron_right
                </span>
              </div>
            </Link>
          </Reveal>
        )}

        {/* ── Semanario: la acción principal del estudiante ── */}
        {fase && (
          <Reveal delay={txPendiente ? 0.1 : 0.05}>
            <Semanario
              fase={fase}
              cupos={cuposDisponibles(susc)}
              nombrePlan={susc?.nombrePlan}
              proximoPago={vencimiento}
              diasIniciales={diasSemana}
              horaInicial={horaSemana}
            />
          </Reveal>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Plan de clase del día */}
          <div className="lg:col-span-8 space-y-6">
            <Reveal delay={0.1}>
              <Card padding="lg">
                <div className="flex flex-wrap items-center gap-3 mb-8">
                  {susc ? (
                    <Badge variant="primary">{susc.nombrePlan}</Badge>
                  ) : (
                    <Badge variant="default">Sin plan</Badge>
                  )}
                </div>
                <h3 className="font-display text-headline-lg text-white mb-10 uppercase tracking-tighter">
                  Clase del Día
                </h3>
                {!claseHoyCargada ? (
                  <div className="flex justify-center py-8"><Spinner size="md" /></div>
                ) : !claseHoy ? (
                  <p className="text-[var(--color-on-surface-variant)]/60">
                    No tienes clase programada hoy.{' '}
                    <Link href="/dashboard/asistencia" className="text-[var(--color-primary-fixed)] hover:underline">
                      Inscríbete en una clase
                    </Link>{' '}
                    para verla acá.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-8">
                      <span className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                        {claseHoy.nombre_clase}
                      </span>
                      <span className="label-caps text-[var(--color-on-surface-variant)]/60 text-[11px]">
                        {new Date(claseHoy.fecha_hora_inicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{claseHoy.sede}
                      </span>
                    </div>
                    <div className="space-y-6">
                      <p className="label-caps text-[var(--color-primary-fixed)] border-b border-[rgba(230,255,0,0.2)] pb-2 inline-block">
                        Protocolo de sesión
                      </p>
                      {claseHoy.plan && claseHoy.plan.length > 0 ? (
                        <ul className="space-y-4">
                          {claseHoy.plan.map((item, i) => (
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
                      ) : (
                        <p className="text-sm text-[var(--color-on-surface-variant)]/50">
                          Tu profesor todavía no subió el plan de esta sesión.
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t border-white/5">
                      <div>
                        <span className="block label-caps text-[var(--color-on-surface-variant)]/50 mb-2">Cupo</span>
                        <span className="block font-display text-headline-md font-extrabold text-[var(--color-primary-fixed)] uppercase tracking-tighter">
                          {claseHoy.estudiantes_inscritos?.length ?? 0}<span className="text-sm opacity-50">/{claseHoy.cupo_maximo}</span>
                        </span>
                      </div>
                      <div>
                        <span className="block label-caps text-[var(--color-on-surface-variant)]/50 mb-2">Estado</span>
                        <span className="block font-display text-headline-md font-extrabold text-[var(--color-primary-fixed)] uppercase tracking-tighter">
                          {claseHoy.estado === 'en_curso' ? 'En curso' : 'Programada'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </Reveal>

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
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Asistencia del ciclo</h3>
                  <span className="material-symbols-outlined text-[var(--color-success-emerald)] text-[24px]">check_circle</span>
                </div>
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="font-display text-display-lg font-black text-white leading-none">{asistidas}</span>
                  <span className="label-caps text-[var(--color-on-surface-variant)]/60">sesiones asistidas</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${tasa}%` }}
                    transition={{ duration: 0.8, ease: EASE }}
                    className="h-full bg-[var(--color-primary-fixed)] shadow-[0_0_15px_rgba(230,255,0,0.4)] rounded-full"
                  />
                </div>
                <p className="label-caps text-[11px] text-[var(--color-on-surface-variant)]/60">
                  {susc
                    ? `${susc.sesionesRestantes} sesiones restantes en tu plan`
                    : 'Sin plan activo — contacta al administrador'}
                </p>
              </Card>
            </Reveal>

            {companeros.length > 0 && (
              <Reveal delay={0.3}>
                <Card>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Tu sede</h3>
                    <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">military_tech</span>
                  </div>
                  <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-6">
                    {user?.sede} · tasa de asistencia
                  </p>
                  <div className="space-y-3">
                    {companeros.slice(0, 5).map((r) => (
                      <div
                        key={r.uid}
                        className={`flex items-center gap-4 p-3 rounded-2xl transition-colors ${
                          r.esYo
                            ? 'bg-[rgba(230,255,0,0.1)] border border-[rgba(230,255,0,0.2)]'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <span className={`font-black text-[12px] w-4 ${r.esYo ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/30'}`}>
                          {String(r.pos).padStart(2, '0')}
                        </span>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                          r.esYo ? 'bg-[var(--color-primary-fixed)] text-black' : 'bg-white/10 border border-white/10 text-white'
                        }`}>
                          {r.nombre.charAt(0)}{r.nombre.split(' ')[1]?.charAt(0) ?? ''}
                        </div>
                        <span className={`flex-1 label-caps truncate ${r.esYo ? 'text-white font-black' : 'text-[var(--color-on-surface-variant)]/70'}`}>
                          {r.esYo ? `${firstName} (Tú)` : r.nombre}
                        </span>
                        <span className={`font-black ${r.esYo ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-on-surface-variant)]/60'}`}>
                          {r.tasa}%
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </Reveal>
            )}

            <Reveal delay={0.35}>
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Mi plan</h3>
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">workspace_premium</span>
                </div>
                {susc ? (
                  <>
                    <p className="font-display text-2xl font-black text-white uppercase tracking-tight leading-tight">
                      {susc.nombrePlan}
                    </p>
                    <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mt-2 mb-5">
                      {susc.sesionesRestantes} sesiones restantes
                    </p>
                    <div className="flex items-center justify-between py-4 border-y border-white/5 mb-5">
                      <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">Vencimiento</span>
                      <span className="font-display font-black text-white text-sm">
                        {vencimientoDate ? vencimientoDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[var(--color-on-surface-variant)]/60 mb-5">
                    No tienes un plan activo. Solicita uno al administrador.
                  </p>
                )}
                <Link href="/dashboard/planes">
                  <Button variant="outline" size="md" fullWidth>{susc ? 'Ver mis planes' : 'Solicitar plan'}</Button>
                </Link>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ── Mensajes: muro de la clase + privado con el profesor ── */}
        <Reveal delay={0.15}>
          <MensajesAlumno
            alumnoId={user?.uid ?? ''}
            alumnoNombre={firstName}
            claseId={susc?.planId ?? 'knowill'}
            claseNombre={susc?.nombrePlan ?? 'Tu clase'}
          />
        </Reveal>

        <Reveal delay={0.1}>
          <ScrollVideoPanel />
        </Reveal>

        <Reveal delay={0.15}>
          <div>
            <p className="label-caps text-[var(--color-on-surface-variant)]/50 mb-4">Identidad Faros</p>
            <BrandImageStrip />
          </div>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
