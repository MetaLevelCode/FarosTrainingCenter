'use client'

// ============================================================
// FAROS — Estudiante · Perfil
// Datos de usuario.suscripcionesActivas + estadísticas.
// Buzón de sugerencias escribe a colección `sugerencias`.
// ============================================================

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button, Spinner } from '@/components/ui'
import { AvatarFoto } from '@/components/shared/AvatarFoto'
import { MetaLevelWatermark } from '@/components/shared/MetaLevelWatermark'
import { useAuth } from '@/contexts/AuthContext'
import { getFirebase } from '@/lib/firebase'
import { listaSuscripciones } from '@/lib/types'
import type { Sugerencia } from '@/lib/types'

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

export default function PerfilPage() {
  const { authorized, loading } = useRoleGuard(['estudiante'])
  const { user, signOut } = useAuth()
  const router = useRouter()

  const [sugerencia, setSugerencia] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [fotoLocal, setFotoLocal] = useState<string | null>(null)
  
  const [historialSugerencias, setHistorialSugerencias] = useState<Sugerencia[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(true)

  const nombre = user ? `${user.nombres} ${user.apellidos}` : 'Atleta'
  // El alumno puede tener varios planes activos a la vez (ej. natación
  // personalizada + actividad física).
  const planes = listaSuscripciones(user)
  const susc = planes[0]
  const iniciales = user ? `${user.nombres.charAt(0)}${user.apellidos.charAt(0)}`.toUpperCase() : 'A'

  useEffect(() => {
    if (!user?.uid) return
    fetchHistorialSugerencias()
  }, [user?.uid])

  async function fetchHistorialSugerencias() {
    if (!user?.uid) return
    setCargandoHistorial(true)
    try {
      const { getSugerenciasUsuario } = await import('@/lib/firestore')
      const res = await getSugerenciasUsuario(user.uid)
      setHistorialSugerencias(res)
    } catch (err) {
      console.error(err)
    } finally {
      setCargandoHistorial(false)
    }
  }

  async function enviarSugerencia(e: React.FormEvent) {
    e.preventDefault()
    if (!sugerencia.trim() || !user) return
    setEnviando(true)
    try {
      const [{ db }, { collection, addDoc }] = await Promise.all([
        getFirebase(), import('firebase/firestore'),
      ])
      await addDoc(collection(db, 'sugerencias'), {
        uid: user.uid,
        displayName: nombre,
        mensaje: sugerencia.trim(),
        createdAt: Date.now(),
        leida: false,
      })
      setEnviada(true)
      setSugerencia('')
      fetchHistorialSugerencias()
      setTimeout(() => setEnviada(false), 3500)
    } catch (err) {
      console.error(err)
    } finally {
      setEnviando(false)
    }
  }

  async function handleSignOut() {
    setCerrando(true)
    await signOut()
    router.replace('/login')
  }

  const personales = user ? [
    { icon: 'badge', label: 'Cédula', value: user.cedula || '—' },
    { icon: 'call', label: 'Celular', value: user.telefono || '—' },
    { icon: 'mail', label: 'Correo', value: user.email },
    { icon: 'location_on', label: 'Sede', value: user.sede || '—' },
    { icon: 'pool', label: 'Nivel', value: user.nivel || '—' },
    { icon: 'emergency', label: 'Emergencia', value: user.telefonoEmergencia || '—' },
  ] : []

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
                      <Badge variant="primary">Estudiante</Badge>
                      <Badge variant={susc?.estado === 'activa' ? 'success' : 'danger'}>
                        {susc?.estado === 'activa' ? 'Activo' : susc ? 'Vencido' : 'Sin plan'}
                      </Badge>
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
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Tu plan</h3>
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">workspace_premium</span>
                </div>
                {planes.length > 1 ? (
                  <>
                    <div className="space-y-3 mb-4">
                      {planes.map((p) => (
                        <div key={p.suscripcionId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="font-display text-base font-black text-[var(--color-primary-fixed)]">{p.nombrePlan}</p>
                            <Badge variant={p.estado === 'activa' ? 'success' : 'danger'}>
                              {p.estado === 'activa' ? 'Activo' : 'Vencido'}
                            </Badge>
                          </div>
                          <p className="text-xs text-[var(--color-on-surface-variant)]/60">
                            {p.sesionesRestantes} sesiones restantes · Vence: {new Date(p.fechaVencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })}
                          </p>
                        </div>
                      ))}
                    </div>
                    {user?.eps && (
                      <div className="mt-auto pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">EPS</span>
                          <span className="text-sm text-white">{user.eps}</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : susc ? (
                  <>
                    <p className="font-display text-3xl font-black leading-tight text-[var(--color-primary-fixed)] mb-2">
                      {susc.nombrePlan}
                    </p>
                    <p className="label-caps text-[11px] text-white mb-6">
                      {susc.sesionesRestantes} sesiones restantes
                    </p>
                    <div className="rounded-2xl border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.08)] p-4 flex items-center gap-3 mb-4">
                      <span className="material-symbols-outlined text-[var(--color-success-emerald)]">verified</span>
                      <div>
                        <p className="text-sm font-bold text-white">Plan activo</p>
                        <p className="text-[11px] text-[var(--color-on-surface-variant)]/60">
                          Vence: {new Date(susc.fechaVencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })}
                        </p>
                      </div>
                    </div>
                    {user?.eps && (
                      <div className="mt-auto pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">EPS</span>
                          <span className="text-sm text-white">{user.eps}</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-white/20 mb-3">fitness_center</span>
                    <p className="text-sm text-[var(--color-on-surface-variant)]/60">Sin plan activo</p>
                    <p className="text-xs text-[var(--color-on-surface-variant)]/40 mt-1">Solicita uno al administrador</p>
                  </div>
                )}
              </Card>
            </Reveal>
          </div>
        </div>

        {/* Buzón */}
        <Reveal delay={0.2}>
          <Card padding="lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">forum</span>
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Buzón de sugerencias
              </h3>
            </div>
            <p className="text-sm text-[var(--color-on-surface-variant)]/60 mb-6 max-w-xl">
              Tu mensaje llega directo a la administración de Faros.
            </p>
            <form onSubmit={enviarSugerencia} className="flex flex-col gap-4">
              <textarea
                value={sugerencia}
                onChange={(e) => setSugerencia(e.target.value)}
                placeholder="Escribe tu sugerencia..."
                rows={4}
                aria-label="Tu sugerencia para administración"
                className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/30 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors duration-300 resize-none"
              />
              <div className="flex justify-end">
                <Button type="submit" size="md" loading={enviando} disabled={enviada}>
                  {enviada ? 'Enviada ✓' : 'Enviar a administración'}
                </Button>
              </div>
            </form>
          </Card>
        </Reveal>

        {/* Historial de Sugerencias */}
        {historialSugerencias.length > 0 && (
          <Reveal delay={0.22}>
            <Card padding="lg">
              <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-tight mb-5">
                Mis sugerencias enviadas
              </h3>
              <div className="space-y-4">
                {historialSugerencias.map((s) => (
                  <div key={s.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <p className="text-sm text-white/90 italic">"{s.mensaje}"</p>
                      <Badge variant={s.respuesta ? 'success' : 'default'} className="shrink-0">
                        {s.respuesta ? 'Respondida' : 'Pendiente'}
                      </Badge>
                    </div>
                    <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-3">
                      {new Date(s.createdAt).toLocaleDateString('es-CO')}
                    </p>
                    
                    {s.respuesta && (
                      <div className="bg-[rgba(230,255,0,0.05)] border border-[rgba(230,255,0,0.15)] rounded-xl p-4 mt-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-[14px] text-[var(--color-primary-fixed)]">forum</span>
                          <span className="label-caps text-[10px] text-[var(--color-primary-fixed)]">Respuesta de Admin</span>
                        </div>
                        <p className="text-sm text-white/80">{s.respuesta}</p>
                        {s.respondidaAt && (
                          <p className="label-caps text-[8px] text-[var(--color-primary-fixed)]/50 mt-2">
                            {new Date(s.respondidaAt).toLocaleDateString('es-CO')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        )}

        {/* Cerrar sesión */}
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
