'use client'

// ============================================================
// FAROS — Bandeja de solicitudes de clases personalizadas
// Alumnos con plan personal piden una franja de la disponibilidad
// declarada por el profesor (ver /portal/perfil); acá el profesor
// acepta o rechaza. Solo se renderiza si hay algo pendiente.
// ============================================================

import { useEffect, useState } from 'react'
import { Card, Badge, Button } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { getFirebase } from '@/lib/firebase'
import type { SolicitudPersonalizada } from '@/lib/types'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

async function getIdToken(): Promise<string | null> {
  const { getAuth } = await import('firebase/auth')
  return (await getAuth().currentUser?.getIdToken()) ?? null
}

export function SolicitudesPendientes() {
  const { user } = useAuth()
  const [solicitudes, setSolicitudes] = useState<SolicitudPersonalizada[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [rechazando, setRechazando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [mensajesAceptar, setMensajesAceptar] = useState<Record<string, string>>({})
  const [error, setError] = useState<{ id: string; texto: string } | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    let unsub = () => {}
    let cancelado = false
    ;(async () => {
      try {
        const [{ db }, { collection, query, where, orderBy, onSnapshot }] = await Promise.all([
          getFirebase(), import('firebase/firestore'),
        ])
        if (cancelado) return
        unsub = onSnapshot(
          query(
            collection(db, 'solicitudes_personalizadas'),
            where('profesorId', '==', user.uid),
            where('estado', '==', 'pendiente'),
            orderBy('creadoEn', 'desc'),
          ),
          (snap) => {
            setSolicitudes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SolicitudPersonalizada))
            setCargando(false)
          },
          (err) => {
            console.error(err)
            setCargando(false)
          }
        )
      } catch (err) {
        console.error(err)
        setCargando(false)
      }
    })()
    return () => {
      cancelado = true
      unsub()
    }
  }, [user?.uid])

  async function aceptar(id: string) {
    setError(null)
    setProcesando(id)
    try {
      const token = await getIdToken()
      const res = await fetch(`/api/personalizadas/${id}/aceptar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: mensajesAceptar[id]?.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo aceptar')
      setSolicitudes((prev) => prev.filter((s) => s.id !== id))
    } catch (err: any) {
      setError({ id, texto: err.message ?? 'No se pudo aceptar. Intenta de nuevo.' })
    } finally {
      setProcesando(null)
    }
  }

  async function rechazar(id: string) {
    if (!motivo.trim()) return
    setError(null)
    setProcesando(id)
    try {
      const token = await getIdToken()
      const res = await fetch(`/api/personalizadas/${id}/rechazar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo rechazar')
      setSolicitudes((prev) => prev.filter((s) => s.id !== id))
      setRechazando(null)
      setMotivo('')
    } catch (err: any) {
      setError({ id, texto: err.message ?? 'No se pudo rechazar. Intenta de nuevo.' })
    } finally {
      setProcesando(null)
    }
  }

  if (cargando || solicitudes.length === 0) return null

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-tight">
          Solicitudes de clase personalizada
        </h3>
        <Badge variant="primary">{solicitudes.length}</Badge>
      </div>
      <div className="space-y-3">
        {solicitudes.map((s) => (
          <div key={s.id} className="p-4 rounded-2xl border border-white/5 bg-white/[0.03]">
            <div className="flex items-start justify-between gap-3 mb-1">
              <p className="font-display font-black text-white text-sm uppercase tracking-tight">{s.nombreAlumno}</p>
              <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 shrink-0">
                {s.personas} {s.personas === 1 ? 'persona' : 'personas'}
              </span>
            </div>
            <div className="space-y-0.5 mb-1">
              {s.franjas.map((f, i) => (
                <p key={i} className="text-sm text-[var(--color-on-surface-variant)]/70">
                  {DIAS[f.dow]} · {f.horaInicio} – {f.horaFin}
                </p>
              ))}
            </div>
            <p className="flex items-center gap-1 text-xs text-[var(--color-on-surface-variant)]/60 mb-3">
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              {s.direccion}
            </p>
            {s.mensaje && (
              <p className="text-xs text-[var(--color-on-surface-variant)]/50 italic mb-3">&ldquo;{s.mensaje}&rdquo;</p>
            )}

            {error?.id === s.id && (
              <p className="text-sm text-[var(--color-danger-crimson)] mb-3">{error.texto}</p>
            )}

            {rechazando === s.id ? (
              <div className="space-y-2">
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo del rechazo…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30"
                />
                <div className="flex gap-2">
                  <Button
                    variant="danger" size="sm" fullWidth
                    disabled={!motivo.trim()}
                    loading={procesando === s.id}
                    onClick={() => rechazar(s.id)}
                  >
                    Confirmar rechazo
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setRechazando(null); setMotivo('') }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  value={mensajesAceptar[s.id] ?? ''}
                  onChange={(e) => setMensajesAceptar((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  placeholder="Mensaje para el alumno al aceptar (opcional)…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30"
                />
                <div className="flex gap-2">
                  <Button size="sm" fullWidth loading={procesando === s.id} onClick={() => aceptar(s.id)}>
                    Aceptar
                  </Button>
                  <Button variant="outline" size="sm" fullWidth onClick={() => setRechazando(s.id)}>
                    Rechazar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
