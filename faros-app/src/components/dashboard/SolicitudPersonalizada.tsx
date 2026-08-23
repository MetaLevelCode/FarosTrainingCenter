'use client'

// ============================================================
// FAROS — Solicitud de clase personalizada (alumno)
// Reemplaza la sección "Clases disponibles" grupal cuando el plan
// activo del alumno es tipo 'personal': el alumno elige un profesor
// y una de sus franjas declaradas, y manda la solicitud. El profesor
// la acepta/rechaza desde /portal (ver SolicitudesPendientes).
// ============================================================

import { useEffect, useState } from 'react'
import { Card, Badge, Button, Spinner } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { getFirebase } from '@/lib/firebase'
import type { FranjaDisponibilidad, SolicitudPersonalizada as Solicitud } from '@/lib/types'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

type Profesor = { uid: string; nombre: string; franjas: FranjaDisponibilidad[] }

async function getIdToken(): Promise<string | null> {
  const { getAuth } = await import('firebase/auth')
  return (await getAuth().currentUser?.getIdToken()) ?? null
}

export function SolicitudPersonalizada() {
  const { user } = useAuth()
  const [cargando, setCargando] = useState(true)
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null)
  const [profesores, setProfesores] = useState<Profesor[]>([])
  const [profesorSel, setProfesorSel] = useState<string>('')
  const [franjaSel, setFranjaSel] = useState<number>(0)
  const [enviando, setEnviando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    if (!user?.uid) return
    setCargando(true)
    try {
      const [{ db }, { collection, query, where, orderBy, limit, getDocs }] = await Promise.all([
        getFirebase(), import('firebase/firestore'),
      ])

      const solSnap = await getDocs(
        query(
          collection(db, 'solicitudes_personalizadas'),
          where('alumnoId', '==', user.uid),
          orderBy('creadoEn', 'desc'),
          limit(1),
        ),
      )
      const sol = solSnap.empty ? null : ({ id: solSnap.docs[0].id, ...solSnap.docs[0].data() } as Solicitud)
      setSolicitud(sol && (sol.estado === 'pendiente' || sol.estado === 'aceptada') ? sol : null)

      if (!sol || (sol.estado !== 'pendiente' && sol.estado !== 'aceptada')) {
        const profSnap = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'profesor')))
        const lista = profSnap.docs
          .map((d) => {
            const u = d.data()
            return {
              uid: d.id,
              nombre: `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim(),
              franjas: (u.disponibilidadPersonal ?? []) as FranjaDisponibilidad[],
            }
          })
          .filter((p) => p.franjas.length > 0)
        setProfesores(lista)
        if (lista[0]) setProfesorSel(lista[0].uid)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  async function solicitar() {
    const profesor = profesores.find((p) => p.uid === profesorSel)
    const franja = profesor?.franjas[franjaSel]
    if (!profesor || !franja) return
    setError(null)
    setEnviando(true)
    try {
      const token = await getIdToken()
      const res = await fetch('/api/personalizadas/solicitar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profesorId: profesor.uid, dow: franja.dow,
          horaInicio: franja.horaInicio, horaFin: franja.horaFin,
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

  return (
    <div>
      <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight mb-5">
        Clase personalizada
      </h3>

      {error && <p className="text-sm text-[var(--color-danger-crimson)] mb-4">{error}</p>}

      {solicitud?.estado === 'pendiente' ? (
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <Badge variant="default">Esperando respuesta del profesor</Badge>
          </div>
          <p className="text-sm text-white mb-1">
            {DIAS[solicitud.dow]} · {solicitud.horaInicio} – {solicitud.horaFin}
          </p>
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
          <p className="text-sm text-white">
            {DIAS[solicitud.dow]} · {solicitud.horaInicio} – {solicitud.horaFin}
          </p>
          <p className="text-xs text-[var(--color-on-surface-variant)]/50 mt-1">
            Tus clases ya aparecen en &ldquo;Mis clases&rdquo; arriba.
          </p>
        </Card>
      ) : profesores.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-on-surface-variant)]/60">
            Ningún profesor tiene franjas disponibles todavía. Consulta con la administración.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Profesor</label>
              <select
                value={profesorSel}
                onChange={(e) => { setProfesorSel(e.target.value); setFranjaSel(0) }}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
              >
                {profesores.map((p) => <option key={p.uid} value={p.uid}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Franja</label>
              <select
                value={franjaSel}
                onChange={(e) => setFranjaSel(Number(e.target.value))}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
              >
                {profesorActual?.franjas.map((f, i) => (
                  <option key={i} value={i}>{DIAS[f.dow]} · {f.horaInicio} – {f.horaFin}</option>
                ))}
              </select>
            </div>
            <Button fullWidth loading={enviando} onClick={solicitar}>
              Solicitar esta franja
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
