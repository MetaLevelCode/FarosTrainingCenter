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
import { useAuth } from '@/contexts/AuthContext'

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
    </GuardedShell>
  )
}
