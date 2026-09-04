'use client'

// ============================================================
// FAROS — Solicitud de clase personalizada (alumno)
// Reemplaza la sección "Clases disponibles" grupal cuando el plan
// activo del alumno es tipo 'personal': el alumno elige un profesor y
// N franjas de las que declaró (N = frecuencia semanal del plan — 1x/
// 2x/3x), todas en días distintos, y manda la solicitud. El profesor la
// acepta/rechaza desde /portal (ver SolicitudesPendientes).
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { Card, Badge, Button, Spinner } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { getFirebase } from '@/lib/firebase'
import {
  DURACION_PERSONALIZADA_MIN, slotsDisponibles, sumarMinutos, dowColombia, horaColombia, normalizarFranjas,
} from '@/lib/recurrencia'
import { listaSuscripciones } from '@/lib/types'
import { COMBINACIONES } from '@/lib/planes'
import type { FranjaDisponibilidad, SolicitudPersonalizada as Solicitud } from '@/lib/types'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

type Profesor = { uid: string; nombre: string; franjas: FranjaDisponibilidad[] }
// Una fila = una de las N franjas semanales que exige el plan.
// franjaIdx referencia una posición en profesor.franjas (-1 = sin elegir).
type FilaSlot = { franjaIdx: number; slot: string }

async function getIdToken(): Promise<string | null> {
  const { getAuth } = await import('firebase/auth')
  return (await getAuth().currentUser?.getIdToken()) ?? null
}

/** Set de `${dow}:${horaInicio}` ya cubiertos por una Clase real futura del profesor. */
async function cargarOcupados(profesorId: string): Promise<Set<string>> {
  const [{ db }, { collection, query, where, orderBy, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDocs(
    query(
      collection(db, 'clases'),
      where('instructor_id', '==', profesorId),
      where('fecha_hora_inicio', '>=', Date.now()),
      orderBy('fecha_hora_inicio', 'desc'),
    ),
  )
  const ocupados = new Set<string>()
  snap.docs.forEach((d) => {
    const c = d.data()
    if (c.estado === 'cancelada') return
    ocupados.add(`${dowColombia(c.fecha_hora_inicio)}:${horaColombia(c.fecha_hora_inicio)}`)
  })
  return ocupados
}

function slotsLibres(franja: FranjaDisponibilidad, ocupados: Set<string>): string[] {
  return slotsDisponibles(franja.horaInicio, franja.horaFin)
    .filter((s) => !ocupados.has(`${franja.dow}:${s}`))
}

/** Arma las N filas iniciales: una franja por día distinto, con la primera hora libre. */
function inicializarFilas(profesor: Profesor, ocupados: Set<string>, n: number): FilaSlot[] {
  const diasUsados = new Set<number>()
  const filas: FilaSlot[] = []
  for (let i = 0; i < n; i++) {
    const idx = profesor.franjas.findIndex((f) => !diasUsados.has(f.dow))
    if (idx === -1) { filas.push({ franjaIdx: -1, slot: '' }); continue }
    diasUsados.add(profesor.franjas[idx].dow)
    filas.push({ franjaIdx: idx, slot: slotsLibres(profesor.franjas[idx], ocupados)[0] ?? '' })
  }
  return filas
}

/** Franjas del profesor elegibles para esta fila — sin repetir el día de otra fila. */
function opcionesFranjaPara(profesor: Profesor, filas: FilaSlot[], filaIdx: number) {
  const diasOtras = new Set(
    filas
      .filter((_, i) => i !== filaIdx)
      .map((fl) => (fl.franjaIdx >= 0 ? profesor.franjas[fl.franjaIdx]?.dow : null))
      .filter((d): d is number => d != null),
  )
  return profesor.franjas
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => !diasOtras.has(f.dow))
}

export function SolicitudPersonalizada() {
  const { user } = useAuth()
  // El alumno puede tener VARIAS entradas tipo:'personal' a la vez (ej.
  // natación personalizada + actividad física) — cada una agenda su
  // propia franja/solicitud por separado. Con una sola, se comporta
  // igual que antes (sin selector visible).
  const personales = useMemo(
    () => listaSuscripciones(user).filter((s) => s.tipo === 'personal' && s.estado === 'activa'),
    [user],
  )
  const [suscripcionIdSel, setSuscripcionIdSel] = useState<string>('')
  useEffect(() => {
    // Si el plan seleccionado ya no está entre los activos (venció, o
    // cambió el usuario), vuelve al primero disponible.
    if (personales.length === 0) { setSuscripcionIdSel(''); return }
    if (!personales.some((s) => s.suscripcionId === suscripcionIdSel)) {
      setSuscripcionIdSel(personales[0].suscripcionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personales])
  const planActivo = personales.find((s) => s.suscripcionId === suscripcionIdSel) ?? personales[0] ?? user?.suscripcionActiva
  const franjasRequeridas = Math.max(1, planActivo?.week ?? 1)
  const [cargando, setCargando] = useState(true)
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null)
  const [profesores, setProfesores] = useState<Profesor[]>([])
  const [profesorSel, setProfesorSel] = useState<string>('')
  const [filas, setFilas] = useState<FilaSlot[]>([])
  const [direccion, setDireccion] = useState('')
  const [ocupados, setOcupados] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function elegirProfesor(uid: string, lista: Profesor[]) {
    setProfesorSel(uid)
    const profesor = lista.find((p) => p.uid === uid)
    const ocupadosSet = await cargarOcupados(uid)
    setOcupados(ocupadosSet)
    setFilas(profesor ? inicializarFilas(profesor, ocupadosSet, franjasRequeridas) : [])
  }

  async function cargar() {
    if (!user?.uid) return
    setCargando(true)
    try {
      const [{ db }, { collection, query, where, orderBy, limit, getDocs }] = await Promise.all([
        getFirebase(), import('firebase/firestore'),
      ])

      // Con más de un plan 'personal' activo, cada uno agenda su propia
      // solicitud — sin filtrar por suscripcionId, la última solicitud de
      // CUALQUIERA de los planes tapa el estado del que se está viendo.
      const solSnap = await getDocs(
        personales.length > 1 && suscripcionIdSel
          ? query(
              collection(db, 'solicitudes_personalizadas'),
              where('alumnoId', '==', user.uid),
              where('suscripcionId', '==', suscripcionIdSel),
              orderBy('creadoEn', 'desc'),
              limit(1),
            )
          : query(
              collection(db, 'solicitudes_personalizadas'),
              where('alumnoId', '==', user.uid),
              orderBy('creadoEn', 'desc'),
              limit(1),
            ),
      )
      const sol = solSnap.empty ? null : ({ id: solSnap.docs[0].id, ...solSnap.docs[0].data() } as Solicitud)
      if (sol) sol.franjas = normalizarFranjas(sol)
      setSolicitud(sol && (sol.estado === 'pendiente' || sol.estado === 'aceptada') ? sol : null)

      if (!sol || (sol.estado !== 'pendiente' && sol.estado !== 'aceptada')) {
        const token = await getIdToken()
        const res = await fetch('/api/profesores/publico', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => ({}))
        const profs = (data.profesores ?? []) as { uid: string; nombres: string; apellidos: string; disponibilidadPersonal?: FranjaDisponibilidad[] }[]
        const lista = profs
          .map((u) => ({
            uid: u.uid,
            nombre: `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim(),
            franjas: (u.disponibilidadPersonal ?? []) as FranjaDisponibilidad[],
          }))
          // Necesita al menos `franjasRequeridas` días distintos declarados
          // — si no, no alcanza a cubrir la frecuencia semanal del plan.
          .filter((p) => new Set(p.franjas.map((f) => f.dow)).size >= franjasRequeridas)
        setProfesores(lista)
        if (lista[0]) await elegirProfesor(lista[0].uid, lista)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [user?.uid, suscripcionIdSel]) // eslint-disable-line react-hooks/exhaustive-deps

  async function solicitar() {
    const profesor = profesores.find((p) => p.uid === profesorSel)
    if (!profesor || !direccion.trim()) return
    if (filas.length !== franjasRequeridas || filas.some((fl) => fl.franjaIdx < 0 || !fl.slot)) return

    const franjasBody = filas.map((fl) => {
      const f = profesor.franjas[fl.franjaIdx]
      return { dow: f.dow, horaInicio: fl.slot, horaFin: sumarMinutos(fl.slot, DURACION_PERSONALIZADA_MIN) }
    })

    setError(null)
    setEnviando(true)
    try {
      const token = await getIdToken()
      const res = await fetch('/api/personalizadas/solicitar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profesorId: profesor.uid, franjas: franjasBody, direccion: direccion.trim(),
          suscripcionId: planActivo?.suscripcionId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo enviar la solicitud')
      await cargar()
    } catch (err: any) {
      setError(err.message ?? 'No se pudo enviar la solicitud. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  async function cancelar() {
    if (!solicitud) return
    setCancelando(true)
    setError(null)
    try {
      const token = await getIdToken()
      const res = await fetch(`/api/personalizadas/${solicitud.id}/cancelar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cancelar')
      await cargar()
    } catch (err: any) {
      setError(err.message ?? 'No se pudo cancelar. Intenta de nuevo.')
    } finally {
      setCancelando(false)
    }
  }

  if (cargando) {
    return (
      <div>
        <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-5">
          Clase personalizada
        </h3>
        <div className="flex justify-center py-8"><Spinner size="md" /></div>
      </div>
    )
  }

  const profesorActual = profesores.find((p) => p.uid === profesorSel)
  const puedeEnviar = filas.length === franjasRequeridas
    && filas.every((fl) => fl.franjaIdx >= 0 && fl.slot)
    && !!direccion.trim()

  return (
    <div>
      <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-5">
        Clase personalizada
      </h3>

      {personales.length > 1 && (
        <div className="flex gap-2 mb-5">
          {personales.map((s) => {
            const nombre = COMBINACIONES.find((c) => c.id === s.combinacionId)?.nombre ?? s.nombrePlan
            const activo = s.suscripcionId === suscripcionIdSel
            return (
              <button
                key={s.suscripcionId}
                onClick={() => setSuscripcionIdSel(s.suscripcionId)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-tight transition-colors duration-200 ${
                  activo
                    ? 'bg-[var(--color-primary-fixed)] text-black'
                    : 'bg-white/5 text-[var(--color-on-surface-variant)]/70 border border-white/10 hover:text-white'
                }`}
              >
                {nombre}
              </button>
            )
          })}
        </div>
      )}

      {error && <p className="text-sm text-[var(--color-danger-crimson)] mb-4">{error}</p>}

      {solicitud?.estado === 'pendiente' ? (
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <Badge variant="default">Esperando respuesta del profesor</Badge>
          </div>
          <div className="space-y-1 mb-1">
            {solicitud.franjas.map((f, i) => (
              <p key={i} className="text-sm text-white">
                {DIAS[f.dow]} · {f.horaInicio} – {f.horaFin}
              </p>
            ))}
          </div>
          <p className="text-xs text-[var(--color-on-surface-variant)]/60 mb-1">{solicitud.direccion}</p>
          <p className="text-xs text-[var(--color-on-surface-variant)]/50 mb-4">
            Te avisaremos apenas el profesor responda.
          </p>
          <Button variant="outline" size="sm" loading={cancelando} onClick={cancelar}>
            Cancelar solicitud
          </Button>
        </Card>
      ) : solicitud?.estado === 'aceptada' ? (
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <Badge variant="success">Horario fijo asignado</Badge>
          </div>
          <div className="space-y-1">
            {solicitud.franjas.map((f, i) => (
              <p key={i} className="text-sm text-white">
                {DIAS[f.dow]} · {f.horaInicio} – {f.horaFin}
              </p>
            ))}
          </div>
          <p className="text-xs text-[var(--color-on-surface-variant)]/60 mt-1">{solicitud.direccion}</p>
          {solicitud.mensajeProfesor && (
            <p className="text-xs text-[var(--color-on-surface-variant)]/50 italic mt-2">
              &ldquo;{solicitud.mensajeProfesor}&rdquo;
            </p>
          )}
          <p className="text-xs text-[var(--color-on-surface-variant)]/50 mt-2">
            Tus clases ya aparecen en &ldquo;Mis clases&rdquo; arriba.
          </p>
        </Card>
      ) : profesores.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-on-surface-variant)]/60">
            {franjasRequeridas > 1
              ? `Ningún profesor tiene disponibilidad declarada en ${franjasRequeridas} días distintos (tu plan es ${franjasRequeridas} veces por semana). Consulta con la administración.`
              : 'Ningún profesor tiene franjas disponibles todavía. Consulta con la administración.'}
          </p>
        </Card>
      ) : (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Profesor</label>
              <select
                value={profesorSel}
                onChange={(e) => elegirProfesor(e.target.value, profesores)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
              >
                {profesores.map((p) => <option key={p.uid} value={p.uid}>{p.nombre}</option>)}
              </select>
            </div>

            {franjasRequeridas > 1 && (
              <p className="text-xs text-[var(--color-on-surface-variant)]/50">
                Tu plan es {franjasRequeridas} veces por semana — elige {franjasRequeridas} días distintos.
              </p>
            )}

            {filas.map((fila, filaIdx) => {
              const opciones = profesorActual ? opcionesFranjaPara(profesorActual, filas, filaIdx) : []
              const franjaActual = fila.franjaIdx >= 0 ? profesorActual?.franjas[fila.franjaIdx] : undefined
              const slots = franjaActual ? slotsLibres(franjaActual, ocupados) : []

              return (
                <div key={filaIdx} className="p-3 rounded-2xl border border-white/5 bg-white/[0.02] space-y-3">
                  {franjasRequeridas > 1 && (
                    <p className="label-caps text-[9px] text-[var(--color-primary-fixed)]">Sesión {filaIdx + 1}</p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Día</label>
                    {opciones.length === 0 ? (
                      <p className="text-xs text-[var(--color-on-surface-variant)]/50">
                        No quedan días disponibles de este profesor.
                      </p>
                    ) : (
                      <select
                        value={fila.franjaIdx}
                        onChange={(e) => {
                          const i = Number(e.target.value)
                          const f = profesorActual?.franjas[i]
                          setFilas((prev) => prev.map((fl, idx) => idx === filaIdx
                            ? { franjaIdx: i, slot: f ? (slotsLibres(f, ocupados)[0] ?? '') : '' }
                            : fl))
                        }}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                      >
                        {opciones.map(({ f, i }) => (
                          <option key={i} value={i}>{DIAS[f.dow]} · {f.horaInicio} – {f.horaFin}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Hora</label>
                    {slots.length === 0 ? (
                      <p className="text-xs text-[var(--color-on-surface-variant)]/50">
                        Este profesor no tiene horarios de {DURACION_PERSONALIZADA_MIN} min disponibles en esta franja.
                      </p>
                    ) : (
                      <select
                        value={fila.slot}
                        onChange={(e) => {
                          const slot = e.target.value
                          setFilas((prev) => prev.map((fl, idx) => idx === filaIdx ? { ...fl, slot } : fl))
                        }}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                      >
                        {slots.map((s) => (
                          <option key={s} value={s}>{s} – {sumarMinutos(s, DURACION_PERSONALIZADA_MIN)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="flex flex-col gap-1.5">
              <label className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">
                Dirección donde será la clase
              </label>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Casa, conjunto, torre/apto, punto de referencia…"
                maxLength={300}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30"
              />
              <p className="text-[11px] text-[var(--color-on-surface-variant)]/40">
                El profesor va a tu casa o conjunto — necesita saber dónde llegar.
              </p>
            </div>
            <Button fullWidth loading={enviando} disabled={!puedeEnviar} onClick={solicitar}>
              Solicitar {franjasRequeridas > 1 ? 'estos horarios' : 'este horario'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
