'use client'

// ============================================================
// FAROS — Alumno · Perfil
// Requisitos (notas ② Usuarios) + estándar de identidad Colombia:
//  - Información personal: documento (C.C./T.I.), nacimiento,
//    género, celular, ciudad/departamento
//  - Salud y seguridad: EPS, grupo sanguíneo (RH), contacto
//    de emergencia (clave en un club de natación)
//  - Su plan que pagó (aprobado por el admin)
//  - Buzón de sugerencia (para admin)
//  - Cerrar sesión
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { ROSTER, describirPlan } from '@/lib/planes'
import type { TipoDocumento } from '@/lib/types'

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

const DOC_LABEL: Record<TipoDocumento, string> = {
  CC: 'C.C.',
  TI: 'T.I.',
  CE: 'C.E.',
}

// Valores demo (Colombia) para cuando el usuario aún no tiene los campos.
const DEMO = {
  tipoDocumento: 'CC' as TipoDocumento,
  documento: '1.088.301.457',
  fechaNacimiento: '14 de marzo de 1998',
  genero: 'Masculino',
  telefono: '+57 310 842 5567',
  ciudad: 'Pereira',
  departamento: 'Risaralda',
  eps: 'Nueva EPS',
  rh: 'O+',
  contactoEmergencia: { nombre: 'María Méndez', parentesco: 'Madre', telefono: '+57 312 559 0148' },
}

function ini(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function PerfilPage() {
  const { authorized, loading } = useRoleGuard(['alumno'])
  const { user, signOut } = useAuth()
  const router = useRouter()

  const [sugerencia, setSugerencia] = useState('')
  const [enviada, setEnviada] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  const nombre = user?.displayName ?? 'Atleta'
  const email = user?.email ?? '—'
  // El plan contratado real (mismo dato que ve el coach y el admin).
  const planActivo = user?.planActivo ?? ROSTER[0].plan
  const plan = describirPlan(planActivo)

  // Datos personales (usuario real → fallback demo Colombia)
  const tipoDoc = user?.tipoDocumento ?? DEMO.tipoDocumento
  const documento = `${DOC_LABEL[tipoDoc]} ${user?.documento ?? DEMO.documento}`
  const nacimiento = user?.fechaNacimiento ?? DEMO.fechaNacimiento
  const genero = user?.genero ?? DEMO.genero
  const telefono = user?.telefono ?? DEMO.telefono
  const ciudad = `${user?.ciudad ?? DEMO.ciudad}, ${user?.departamento ?? DEMO.departamento}`
  const eps = user?.eps ?? DEMO.eps
  const rh = user?.rh ?? DEMO.rh
  const emergencia = user?.contactoEmergencia ?? DEMO.contactoEmergencia

  const personales = [
    { icon: 'badge', label: 'Documento', value: documento },
    { icon: 'cake', label: 'Fecha de nacimiento', value: nacimiento },
    { icon: 'wc', label: 'Género', value: genero },
    { icon: 'call', label: 'Celular', value: telefono },
    { icon: 'mail', label: 'Correo', value: email },
    { icon: 'location_on', label: 'Ciudad', value: ciudad },
  ]

  function enviarSugerencia(e: React.FormEvent) {
    e.preventDefault()
    if (!sugerencia.trim()) return
    setEnviada(true)
    setSugerencia('')
    setTimeout(() => setEnviada(false), 3500)
  }

  async function handleSignOut() {
    setCerrando(true)
    await signOut()
    router.replace('/login')
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Perfil">
      <div className="space-y-8">

        {/* ── Header ── */}
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Tu cuenta</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Perfil
            </h2>
          </div>
        </Reveal>

        {/* ── Identidad + Plan ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Identidad + datos personales */}
          <div className="lg:col-span-7">
            <Reveal delay={0.06}>
              <Card padding="lg" className="h-full">
                <div className="flex items-center gap-5 mb-8">
                  <span className="w-20 h-20 rounded-3xl bg-[var(--color-primary-fixed)] text-black flex items-center justify-center font-display text-2xl font-black shrink-0">
                    {ini(nombre)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight truncate">
                      {nombre}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="primary">Alumno</Badge>
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

          {/* Plan pagado */}
          <div className="lg:col-span-5">
            <Reveal delay={0.12}>
              <Card padding="lg" className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Tu plan</h3>
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">workspace_premium</span>
                </div>

                <p className="font-display text-3xl font-black leading-tight text-[var(--color-primary-fixed)] mb-2">
                  {plan.titulo}
                </p>
                <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mb-1">
                  {plan.tipoLabel} · {plan.frecuenciaLabel}
                </p>
                <p className="label-caps text-[11px] text-white mb-6">
                  {plan.precioTexto} <span className="text-[var(--color-on-surface-variant)]/50">/ mes</span>
                </p>

                {plan.horarios.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {plan.horarios.map((h) => (
                      <span key={h} className="label-caps text-[9px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[var(--color-on-surface-variant)]/70">
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.08)] p-4 flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-[var(--color-success-emerald)]">verified</span>
                  <div>
                    <p className="text-sm font-bold text-white">Aprobado por administración</p>
                    <p className="text-[11px] text-[var(--color-on-surface-variant)]/60">Activo desde {planActivo.desde}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                  <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">Próximo pago</span>
                  <span className="font-display font-black text-white text-sm">{planActivo.proximoPago}</span>
                </div>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ── Salud y seguridad ── */}
        <Reveal delay={0.16}>
          <Card padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">health_and_safety</span>
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Salud y seguridad
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.03]">
                <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/60 text-[20px] shrink-0">local_hospital</span>
                <div className="min-w-0">
                  <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-1">EPS</p>
                  <p className="text-sm text-white truncate">{eps}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.03]">
                <span className="material-symbols-outlined text-[var(--color-danger-crimson)] text-[20px] shrink-0">bloodtype</span>
                <div className="min-w-0">
                  <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-1">Grupo sanguíneo (RH)</p>
                  <p className="text-sm text-white font-black">{rh}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.03]">
                <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/60 text-[20px] shrink-0">emergency</span>
                <div className="min-w-0">
                  <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-1">Contacto de emergencia</p>
                  <p className="text-sm text-white truncate">{emergencia.nombre} · {emergencia.parentesco}</p>
                  <p className="text-[11px] text-[var(--color-on-surface-variant)]/60 truncate">{emergencia.telefono}</p>
                </div>
              </div>
            </div>
          </Card>
        </Reveal>

        {/* ── Buzón de sugerencias ── */}
        <Reveal delay={0.2}>
          <Card padding="lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">forum</span>
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Buzón de sugerencias
              </h3>
            </div>
            <p className="text-sm text-[var(--color-on-surface-variant)]/60 mb-6 max-w-xl">
              ¿Algo que mejorar? Tu mensaje llega directo a la administración de Faros.
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
                <Button type="submit" size="md" disabled={enviada}>
                  {enviada ? 'Enviada ✓' : 'Enviar a administración'}
                </Button>
              </div>
            </form>
          </Card>
        </Reveal>

        {/* ── Cerrar sesión ── */}
        <Reveal delay={0.24}>
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-tight">Cerrar sesión</h3>
                <p className="text-sm text-[var(--color-on-surface-variant)]/60 mt-1">
                  Saldrás de tu cuenta en este dispositivo.
                </p>
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
