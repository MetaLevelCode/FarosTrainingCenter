'use client'

// ============================================================
// FAROS — Estudiante · Asistencia
// Lee colección `asistencias` + clases inscritas del usuario.
// CICLO: sesionesRestantes desde usuario.suscripcionActiva.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import { getFirebase } from '@/lib/firebase'
import type { Clase } from '@/lib/types'

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

type HistorialItem = {
  id: string
  fecha: string
  clase: string
  tipo: string
  asistio: boolean
}

function ini(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function AsistenciaPage() {
  const { authorized, loading, user } = useRoleGuard(['estudiante'])
  const [clasesInscritas, setClasesInscritas] = useState<Clase[]>([])
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [canceladas, setCanceladas] = useState<Set<string>>(new Set())

  const susc = user?.suscripcionActiva
  const sesionesRestantes = susc?.sesionesRestantes ?? 0
  const sesionesCompradas = 0  // Se obtiene de suscripciones si se necesita

  useEffect(() => {
    if (!user) return

    ;(async () => {
      try {
        const [{ db }, { collection, query, where, getDocs, orderBy, limit }] = await Promise.all([
          getFirebase(), import('firebase/firestore'),
        ])

        // Historial de asistencias del usuario
        const asistSnap = await getDocs(
          query(
            collection(db, 'asistencias'),
            where('usuarioId', '==', user.uid),
            orderBy('fecha_registro', 'desc'),
            limit(20),
          ),
        )

        // Para cada asistencia, obtenemos el nombre de la clase
        const items: HistorialItem[] = []
        for (const d of asistSnap.docs) {
          const a = d.data()
          let nombreClase = 'Clase'
          try {
            const claseSnap = await getDocs(
              query(collection(db, 'clases'), where('__name__', '==', a.claseId)),
            )
            if (!claseSnap.empty) nombreClase = claseSnap.docs[0].data().nombre_clase ?? 'Clase'
          } catch {}
          items.push({
            id: d.id,
            fecha: new Date(a.fecha_registro).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).toUpperCase(),
            clase: nombreClase,
            tipo: 'Grupal',
            asistio: a.asistio,
          })
        }
        setHistorial(items)

        // Clases donde está inscrito
        const clasesSnap = await getDocs(
          query(
            collection(db, 'clases'),
            where('estudiantes_inscritos', 'array-contains', user.uid),
            where('estado', 'in', ['programada', 'en_curso']),
          ),
        )
        setClasesInscritas(clasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Clase))
      } catch (err) {
        console.error(err)
      } finally {
        setCargando(false)
      }
    })()
  }, [user])

  const asistidasReales = useMemo(() => historial.filter((h) => h.asistio).length, [historial])
  const faltasReales = useMemo(() => historial.filter((h) => !h.asistio).length, [historial])

  function cancelar(id: string) {
    setCanceladas((prev) => new Set([...prev, id]))
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Asistencia">
      <div className="space-y-8">

        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Tu ciclo actual</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Asistencia
            </h2>
          </div>
        </Reveal>

        {/* ── Suscripción activa ── */}
        <Reveal delay={0.06}>
          {susc ? (
            <Card padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Plan activo</h3>
                <Badge variant={susc.estado === 'activa' ? 'success' : 'danger'}>
                  {susc.estado === 'activa' ? 'Activo' : 'Vencido'}
                </Badge>
              </div>
              <p className="font-display text-2xl font-black text-[var(--color-primary-fixed)] mb-1">{susc.nombrePlan}</p>
              <div className="flex items-baseline gap-3 mt-4">
                <span className="font-display text-display-lg font-black text-white leading-none">{susc.sesionesRestantes}</span>
                <span className="label-caps text-[var(--color-on-surface-variant)]/50">sesiones restantes</span>
              </div>
              <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-3">
                Vence: {new Date(susc.fechaVencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </Card>
          ) : (
            <Card padding="lg">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/40 text-4xl">fitness_center</span>
                <div>
                  <p className="text-sm font-bold text-white">Sin plan activo</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]/60 mt-1">Solicita un plan al administrador para empezar a entrenar.</p>
                </div>
              </div>
            </Card>
          )}
        </Reveal>

        {/* ── Stats rápidos ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Asistencias', value: String(asistidasReales), icon: 'event_available' },
            { label: 'Faltas', value: String(faltasReales), icon: 'event_busy' },
            { label: 'Tasa', value: `${user?.estadisticas?.tasaAsistencia ?? 0}%`, icon: 'speed' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={0.1 + i * 0.04}>
              <Card className="h-full">
                <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-[22px] mb-3">{s.icon}</span>
                <p className="font-display text-xl font-black text-white leading-none tracking-tight">{s.value}</p>
                <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-2">{s.label}</p>
              </Card>
            </Reveal>
          ))}
        </div>

        {/* ── Historial de sesiones ── */}
        <Reveal delay={0.2}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/10 bg-white/[0.02]">
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Historial de asistencia
              </h3>
            </div>
            {cargando ? (
              <div className="px-6 py-10 text-center text-sm text-[var(--color-on-surface-variant)]/40">Cargando…</div>
            ) : historial.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[var(--color-on-surface-variant)]/60">
                Aún no tienes asistencias registradas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[480px]">
                  <thead className="bg-white/5">
                    <tr>
                      {['Fecha', 'Clase', 'Tipo', 'Estado'].map((h) => (
                        <th key={h} className="px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {historial.map((h) => (
                      <tr key={h.id} className="hover:bg-white/[0.03] transition-colors duration-200">
                        <td className="px-6 py-5 font-display font-black text-white text-sm whitespace-nowrap">{h.fecha}</td>
                        <td className="px-6 py-5 text-sm text-[var(--color-on-surface)]">{h.clase}</td>
                        <td className="px-6 py-5"><Badge variant="default">{h.tipo}</Badge></td>
                        <td className="px-6 py-5">
                          {h.asistio
                            ? <Badge variant="success">Asistió</Badge>
                            : <Badge variant="danger">Faltó</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </Reveal>

        {/* ── Próximas clases inscritas ── */}
        <Reveal delay={0.24}>
          <div>
            <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-5">
              Próximas clases
            </h3>
            {cargando ? (
              <p className="text-sm text-[var(--color-on-surface-variant)]/40">Cargando…</p>
            ) : clasesInscritas.length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--color-on-surface-variant)]/60">No tienes clases programadas. Habla con tu profesor para inscribirte.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {clasesInscritas.map((c) => {
                  const cancelada = canceladas.has(c.id)
                  const inicio = new Date(c.fecha_hora_inicio)
                  const dia = inicio.toLocaleDateString('es-CO', { weekday: 'short' }).toUpperCase()
                  const hora = inicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <Card key={c.id} className={cancelada ? 'opacity-60' : ''}>
                      <div className="flex items-start justify-between mb-5">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black text-[var(--color-on-surface-variant)]">
                              {dia}
                            </span>
                            {cancelada && <Badge variant="danger">Cancelada</Badge>}
                          </div>
                          <h4 className="font-display text-lg font-extrabold text-white uppercase tracking-tight">{c.nombre_clase}</h4>
                          <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1">
                            {hora} · {c.sede}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-6">
                        <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">
                          {c.estudiantes_inscritos.length} inscritos · cupo {c.cupo_maximo}
                        </span>
                      </div>
                      <Button
                        variant={cancelada ? 'ghost' : 'outline'}
                        size="sm"
                        fullWidth
                        disabled={cancelada}
                        onClick={() => cancelar(c.id)}
                      >
                        {cancelada ? 'Cancelaste esta clase' : 'Cancelar inscripción'}
                      </Button>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
