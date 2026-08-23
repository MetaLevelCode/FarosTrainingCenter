'use client'

// ============================================================
// FAROS — Estudiante · Asistencia + Inscripción a clases
// Tres secciones:
//  1. Clases disponibles  → el alumno puede inscribirse (API Route)
//  2. Mis clases          → clases donde ya está inscrito (cancelar via API)
//  3. Historial           → asistencias registradas por el profesor
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button, Spinner } from '@/components/ui'
import { getFirebase } from '@/lib/firebase'
import type { Clase } from '@/lib/types'

const EASE = [0.22, 1, 0.36, 1] as const
const VENTANA_CANCELACION_MS = 2 * 60 * 60 * 1000 // 2 horas

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

async function getIdToken(): Promise<string | null> {
  const { getAuth } = await import('firebase/auth')
  return (await getAuth().currentUser?.getIdToken()) ?? null
}

export default function AsistenciaPage() {
  const { authorized, loading, user } = useRoleGuard(['estudiante'])
  const [clasesInscritas, setClasesInscritas] = useState<Clase[]>([])
  const [clasesDisponibles, setClasesDisponibles] = useState<Clase[]>([])
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [inscribiendo, setInscribiendo] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const susc = user?.suscripcionActiva
  const puedeInscribirse = !!susc && susc.estado === 'activa' && (susc.sesionesRestantes ?? 0) > 0

  useEffect(() => {
    if (!user) return

    ;(async () => {
      try {
        const [{ db }, { collection, query, where, getDocs, orderBy, limit, getDoc, doc }] = await Promise.all([
          getFirebase(), import('firebase/firestore'),
        ])
        const ahora = Date.now()

        // Historial de asistencias
        const asistSnap = await getDocs(
          query(
            collection(db, 'asistencias'),
            where('usuarioId', '==', user.uid),
            orderBy('fecha_registro', 'desc'),
            limit(20),
          ),
        )

        const items: HistorialItem[] = []
        for (const d of asistSnap.docs) {
          const a = d.data()
          let nombreClase = 'Clase'
          try {
            const claseDoc = await getDoc(doc(db, 'clases', a.claseId))
            if (claseDoc.exists()) nombreClase = claseDoc.data()?.nombre_clase ?? 'Clase'
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

        // Clases donde está inscrito (futuras o en curso)
        const inscritasSnap = await getDocs(
          query(
            collection(db, 'clases'),
            where('estudiantes_inscritos', 'array-contains', user.uid),
            where('estado', 'in', ['programada', 'en_curso']),
          ),
        )
        const inscritas = inscritasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Clase)
        setClasesInscritas(inscritas)

        // Clases disponibles: programadas en el futuro, sin inscribir aún
        const inscritasIds = new Set(inscritas.map((c) => c.id))
        const disponiblesSnap = await getDocs(
          query(
            collection(db, 'clases'),
            where('estado', '==', 'programada'),
            where('fecha_hora_inicio', '>', ahora),
            orderBy('fecha_hora_inicio', 'asc'),
            limit(12),
          ),
        )
        setClasesDisponibles(
          disponiblesSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Clase)
            .filter((c) => !inscritasIds.has(c.id)),
        )
      } catch (err) {
        console.error(err)
      } finally {
        setCargando(false)
      }
    })()
  }, [user])

  async function inscribirse(claseId: string) {
    setErrorAccion(null)
    setInscribiendo(claseId)
    try {
      const token = await getIdToken()
      if (!token) throw new Error('No autenticado')

      const res = await fetch(`/api/clases/${claseId}/inscribir`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al inscribirse')

      // Actualización optimista: mover la clase a "inscritas"
      setClasesDisponibles((prev) => {
        const clase = prev.find((c) => c.id === claseId)
        if (clase) {
          const actualizada = {
            ...clase,
            estudiantes_inscritos: [...(clase.estudiantes_inscritos ?? []), user!.uid],
          }
          setClasesInscritas((ins) => [...ins, actualizada])
        }
        return prev.filter((c) => c.id !== claseId)
      })
    } catch (err: any) {
      setErrorAccion(err.message ?? 'No se pudo inscribir. Intenta de nuevo.')
    } finally {
      setInscribiendo(null)
    }
  }

  async function cancelarInscripcion(claseId: string) {
    setErrorAccion(null)
    setCancelando(claseId)
    try {
      const token = await getIdToken()
      if (!token) throw new Error('No autenticado')

      const res = await fetch(`/api/clases/${claseId}/cancelar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cancelar')

      // Actualización optimista: devolver a disponibles si sigue siendo futura
      setClasesInscritas((prev) => {
        const clase = prev.find((c) => c.id === claseId)
        if (clase && clase.fecha_hora_inicio > Date.now()) {
          const actualizada = {
            ...clase,
            estudiantes_inscritos: (clase.estudiantes_inscritos ?? []).filter((u) => u !== user!.uid),
          }
          setClasesDisponibles((dis) =>
            [...dis, actualizada].sort((a, b) => a.fecha_hora_inicio - b.fecha_hora_inicio),
          )
        }
        return prev.filter((c) => c.id !== claseId)
      })
    } catch (err: any) {
      setErrorAccion(err.message ?? 'No se pudo cancelar. Intenta de nuevo.')
    } finally {
      setCancelando(null)
    }
  }

  const asistidasReales = useMemo(() => historial.filter((h) => h.asistio).length, [historial])
  const faltasReales = useMemo(() => historial.filter((h) => !h.asistio).length, [historial])

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

        {/* ── Error global de acción ── */}
        {errorAccion && (
          <Reveal>
            <div className="rounded-2xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--color-danger-crimson)] text-[20px]">error</span>
                <p className="text-sm text-[var(--color-danger-crimson)]">{errorAccion}</p>
              </div>
              <button onClick={() => setErrorAccion(null)} className="text-[var(--color-on-surface-variant)]/50 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </Reveal>
        )}

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

        {/* ── Stats ── */}
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

        {/* ── Clases disponibles ── */}
        <Reveal delay={0.16}>
          <div>
            <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-5">
              Clases disponibles
            </h3>
            {!puedeInscribirse && susc && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 mb-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/40 text-[18px]">info</span>
                <p className="text-xs text-[var(--color-on-surface-variant)]/60">
                  {susc.estado !== 'activa' ? 'Tu suscripción está vencida.' : 'No tienes sesiones disponibles.'}{' '}
                  Renueva tu plan para inscribirte en clases.
                </p>
              </div>
            )}
            {cargando ? (
              <div className="flex justify-center py-8"><Spinner size="md" /></div>
            ) : clasesDisponibles.length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--color-on-surface-variant)]/60">
                  No hay clases programadas próximamente. Consulta con tu profesor.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {clasesDisponibles.map((c) => {
                  const inicio = new Date(c.fecha_hora_inicio)
                  const dia = inicio.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'short' })
                  const hora = inicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                  const cuposLibres = (c.cupo_maximo ?? 0) - (c.estudiantes_inscritos?.length ?? 0)
                  const sinCupo = cuposLibres <= 0
                  const isLoading = inscribiendo === c.id
                  return (
                    <Card key={c.id}>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <h4 className="font-display text-base font-extrabold text-white uppercase tracking-tight truncate">
                            {c.nombre_clase}
                          </h4>
                          <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1 capitalize truncate">
                            {dia} · {hora}
                          </p>
                          {c.sede && (
                            <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/40 mt-0.5 truncate">
                              {c.sede}
                            </p>
                          )}
                        </div>
                        <Badge variant={sinCupo ? 'danger' : cuposLibres <= 3 ? 'primary' : 'default'} className="shrink-0 whitespace-nowrap">
                          {sinCupo ? 'Llena' : `${cuposLibres} cupos`}
                        </Badge>
                      </div>
                      <Button
                        fullWidth
                        size="sm"
                        disabled={sinCupo || !puedeInscribirse || !!inscribiendo}
                        loading={isLoading}
                        onClick={() => inscribirse(c.id)}
                      >
                        {isLoading ? '' : sinCupo ? 'Sin cupo' : 'Inscribirse'}
                      </Button>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </Reveal>

        {/* ── Mis clases (inscritas) ── */}
        <Reveal delay={0.22}>
          <div>
            <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-5">
              Mis clases
            </h3>
            {cargando ? (
              <div className="flex justify-center py-6"><Spinner size="md" /></div>
            ) : clasesInscritas.length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--color-on-surface-variant)]/60">
                  No tienes clases próximas. Inscríbete en alguna de las disponibles arriba.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {clasesInscritas.map((c) => {
                  const inicio = new Date(c.fecha_hora_inicio)
                  const dia = inicio.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'short' })
                  const hora = inicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                  const puedeCancelar = c.estado === 'programada' && (c.fecha_hora_inicio - Date.now()) >= VENTANA_CANCELACION_MS
                  const isLoading = cancelando === c.id
                  return (
                    <Card key={c.id}>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={c.estado === 'en_curso' ? 'primary' : 'success'}>
                              {c.estado === 'en_curso' ? 'En curso' : 'Reservada'}
                            </Badge>
                          </div>
                          <h4 className="font-display text-base font-extrabold text-white uppercase tracking-tight truncate">
                            {c.nombre_clase}
                          </h4>
                          <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1 capitalize truncate">
                            {dia} · {hora}
                          </p>
                          {c.sede && (
                            <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/40 mt-0.5 truncate">
                              {c.sede}
                            </p>
                          )}
                        </div>
                        <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/40 shrink-0 text-right">
                          {c.estudiantes_inscritos?.length ?? 0} / {c.cupo_maximo}
                        </span>
                      </div>
                      <Button
                        variant={puedeCancelar ? 'outline' : 'ghost'}
                        size="sm"
                        fullWidth
                        disabled={!puedeCancelar || !!cancelando}
                        loading={isLoading}
                        onClick={() => cancelarInscripcion(c.id)}
                      >
                        {isLoading ? '' : puedeCancelar ? 'Cancelar inscripción' : 'No cancelable (< 2 h)'}
                      </Button>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </Reveal>

        {/* ── Historial de asistencias ── */}
        <Reveal delay={0.28}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/10 bg-white/[0.02]">
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Historial de asistencia
              </h3>
            </div>
            {cargando ? (
              <div className="px-6 py-10 flex justify-center"><Spinner size="md" /></div>
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
      </div>
    </GuardedShell>
  )
}
