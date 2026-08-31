'use client'

// ============================================================
// FAROS — Profesor · Perfil
// Datos del usuario autenticado desde Firestore colección
// `usuarios`. Acumulado de clases desde campo clasesDadas.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import { AvatarFoto } from '@/components/shared/AvatarFoto'
import { MetaLevelWatermark } from '@/components/shared/MetaLevelWatermark'
import { useAuth } from '@/contexts/AuthContext'
import { getFirebase } from '@/lib/firebase'
import type { FranjaDisponibilidad } from '@/lib/types'

const EASE = [0.22, 1, 0.36, 1] as const

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function DisponibilidadPersonal() {
  const { user, refreshUser } = useAuth()
  const [franjas, setFranjas] = useState<FranjaDisponibilidad[]>(user?.disponibilidadPersonal ?? [])
  const [nuevoDow, setNuevoDow] = useState(1)
  const [nuevoInicio, setNuevoInicio] = useState('14:00')
  const [nuevoFin, setNuevoFin] = useState('16:00')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  function agregarFranja() {
    setError(null)
    if (nuevoInicio >= nuevoFin) {
      setError('La hora de inicio debe ser antes que la de fin.')
      return
    }
    const yaExiste = franjas.some((f) => f.dow === nuevoDow && f.horaInicio < nuevoFin && nuevoInicio < f.horaFin)
    if (yaExiste) {
      setError('Esa franja se solapa con una que ya agregaste.')
      return
    }
    setFranjas((prev) => [...prev, { dow: nuevoDow, horaInicio: nuevoInicio, horaFin: nuevoFin }]
      .sort((a, b) => a.dow - b.dow || a.horaInicio.localeCompare(b.horaInicio)))
    setGuardado(false)
  }

  function quitarFranja(i: number) {
    setFranjas((prev) => prev.filter((_, idx) => idx !== i))
    setGuardado(false)
  }

  async function guardar() {
    if (!user) return
    setGuardando(true)
    setError(null)
    try {
      const [{ db }, { doc, updateDoc }] = await Promise.all([
        getFirebase(), import('firebase/firestore'),
      ])
      await updateDoc(doc(db, 'usuarios', user.uid), { disponibilidadPersonal: franjas })
      await refreshUser()
      setGuardado(true)
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card>
      <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-tight mb-1">
        Disponibilidad para clases personalizadas
      </h3>
      <p className="text-sm text-[var(--color-on-surface-variant)]/60 mb-6">
        Franjas semanales fijas en las que puedes dar clases 1-a-1, en pareja o grupo reducido.
        Los alumnos con plan personalizado solo pueden solicitar dentro de estas franjas.
      </p>

      {franjas.length === 0 ? (
        <p className="text-sm text-[var(--color-on-surface-variant)]/50 mb-6">
          Todavía no tienes franjas declaradas.
        </p>
      ) : (
        <div className="space-y-2 mb-6">
          {franjas.map((f, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.03]">
              <span className="text-sm text-white">
                {DIAS[f.dow]} · {f.horaInicio} – {f.horaFin}
              </span>
              <button
                onClick={() => quitarFranja(i)}
                aria-label="Quitar franja"
                className="w-9 h-9 rounded-lg text-[var(--color-on-surface-variant)]/60 hover:text-[var(--color-danger-crimson)] hover:bg-white/5 flex items-center justify-center transition-colors duration-200"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Día</label>
          <select
            value={nuevoDow}
            onChange={(e) => setNuevoDow(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
          >
            {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Desde</label>
          <input
            type="time"
            value={nuevoInicio}
            onChange={(e) => setNuevoInicio(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Hasta</label>
          <input
            type="time"
            value={nuevoFin}
            onChange={(e) => setNuevoFin(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
          />
        </div>
        <Button variant="outline" size="sm" onClick={agregarFranja}>Agregar</Button>
      </div>

      {error && <p className="text-sm text-[var(--color-danger-crimson)] mb-4">{error}</p>}

      <div className="flex items-center gap-3">
        <Button size="md" loading={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar disponibilidad'}
        </Button>
        {guardado && <span className="text-sm text-[var(--color-success-emerald)]">Guardado.</span>}
      </div>
    </Card>
  )
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >{children}</motion.div>
  )
}

export default function PerfilProfesorPage() {
  const { authorized, loading } = useRoleGuard(['profesor', 'admin'])
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [cerrando, setCerrando] = useState(false)
  const [fotoLocal, setFotoLocal] = useState<string | null>(null)

  const nombre = user ? `${user.nombres} ${user.apellidos}` : 'Profesor'
  const iniciales = user ? `${user.nombres.charAt(0)}${user.apellidos.charAt(0)}`.toUpperCase() : 'P'

  const personales = user ? [
    { icon: 'badge', label: 'Cédula', value: user.cedula || '—' },
    { icon: 'call', label: 'Celular', value: user.telefono || '—' },
    { icon: 'mail', label: 'Correo', value: user.email },
    { icon: 'location_on', label: 'Sede', value: user.sede || '—' },
    { icon: 'local_hospital', label: 'EPS', value: user.eps || '—' },
    { icon: 'emergency', label: 'Emergencia', value: user.telefonoEmergencia || '—' },
  ] : []

  async function handleSignOut() {
    setCerrando(true)
    await signOut()
    router.replace('/login')
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Perfil">
      <div className="space-y-8">

        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Tu cuenta</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Perfil
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <Reveal delay={0.06}>
              <Card padding="lg" className="h-full">
                <div className="flex items-center gap-5 mb-8">
                  {user && (
                    <AvatarFoto
                      uid={user.uid}
                      fotoUrl={fotoLocal ?? user.foto_perfil}
                      iniciales={iniciales}
                      onSubida={setFotoLocal}
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight truncate">
                      {nombre}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="primary">Profesor</Badge>
                      <Badge variant="success">Activo</Badge>
                    </div>
                  </div>
                </div>
                <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mb-4">Información personal</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {personales.map((d) => (
                    <div key={d.label} className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.03]">
                      <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/60 text-[20px] shrink-0">{d.icon}</span>
                      <div className="min-w-0">
                        <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-1">{d.label}</p>
                        <p className="text-sm text-white truncate">{d.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
          </div>

          <div className="lg:col-span-5">
            <Reveal delay={0.12}>
              <Card padding="lg" className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Acumulado del mes</h3>
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">insights</span>
                </div>
                <div className="mb-6">
                  <p className="font-display text-4xl font-black text-[var(--color-primary-fixed)] leading-none">
                    {user?.clasesDadas ?? 0}
                  </p>
                  <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-2">Clases dictadas</p>
                </div>
                <p className="text-[11px] text-[var(--color-on-surface-variant)]/50 mt-auto pt-4 border-t border-white/5">
                  Acumulado histórico. Se actualiza con cada clase finalizada.
                </p>
              </Card>
            </Reveal>
          </div>
        </div>

        <Reveal delay={0.18}>
          <DisponibilidadPersonal />
        </Reveal>

        <Reveal delay={0.24}>
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-tight">Cerrar sesión</h3>
                <p className="text-sm text-[var(--color-on-surface-variant)]/60 mt-1">Saldrás de tu cuenta en este dispositivo.</p>
              </div>
              <Button variant="danger" size="md" loading={cerrando} onClick={handleSignOut}>
                {cerrando ? 'Saliendo…' : 'Cerrar sesión'}
              </Button>
            </div>
          </Card>
        </Reveal>
      </div>
      
      {/* ── MetaLevel Code Watermark ── */}
      <div className="mt-16 flex justify-center pb-8">
        <MetaLevelWatermark />
      </div>
    </GuardedShell>
  )
}
