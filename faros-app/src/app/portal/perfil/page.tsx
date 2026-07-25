'use client'

// ============================================================
// FAROS — Entrenador · Perfil
// Requisitos (notas ③ Entrenadores): su perfil.
// Datos personales (estándar Colombia) + info profesional +
// acumulado de clases dictadas.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
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

const DOC_LABEL: Record<TipoDocumento, string> = { CC: 'C.C.', TI: 'T.I.', CE: 'C.E.' }

// Valores demo (Colombia) para cuando el usuario aún no tiene los campos.
const DEMO = {
  tipoDocumento: 'CC' as TipoDocumento,
  documento: '1.093.774.210',
  telefono: '+57 315 226 7841',
  ciudad: 'Pereira',
  departamento: 'Risaralda',
  eps: 'Sura EPS',
  rh: 'A+',
  contactoEmergencia: { nombre: 'Jorge Torres', parentesco: 'Esposo', telefono: '+57 300 771 3320' },
}

// Info profesional (se reemplaza por Firestore)
const PROFESIONAL = {
  especialidad: 'Natación de velocidad y técnica',
  experiencia: '8 años',
  certificacion: 'Entrenador FINA Nivel II',
  clasesMes: 42,
  horasMes: 128,
}

function ini(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function PerfilEntrenadorPage() {
  const { authorized, loading } = useRoleGuard(['entrenador', 'admin'])
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [cerrando, setCerrando] = useState(false)

  const nombre = user?.displayName ?? 'Entrenador'
  const email = user?.email ?? '—'

  const tipoDoc = user?.tipoDocumento ?? DEMO.tipoDocumento
  const documento = `${DOC_LABEL[tipoDoc]} ${user?.documento ?? DEMO.documento}`
  const telefono = user?.telefono ?? DEMO.telefono
  const ciudad = `${user?.ciudad ?? DEMO.ciudad}, ${user?.departamento ?? DEMO.departamento}`
  const eps = user?.eps ?? DEMO.eps
  const rh = user?.rh ?? DEMO.rh
  const emergencia = user?.contactoEmergencia ?? DEMO.contactoEmergencia

  const personales = [
    { icon: 'badge', label: 'Documento', value: documento },
    { icon: 'call', label: 'Celular', value: telefono },
    { icon: 'mail', label: 'Correo', value: email },
    { icon: 'location_on', label: 'Ciudad', value: ciudad },
  ]

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

        {/* ── Identidad + acumulado ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
                      <Badge variant="primary">Entrenador</Badge>
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

          {/* Acumulado del mes (se reporta al admin) */}
          <div className="lg:col-span-5">
            <Reveal delay={0.12}>
              <Card padding="lg" className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Acumulado del mes</h3>
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">insights</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="font-display text-4xl font-black text-[var(--color-primary-fixed)] leading-none">{PROFESIONAL.clasesMes}</p>
                    <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-2">Clases dictadas</p>
                  </div>
                  <div>
                    <p className="font-display text-4xl font-black text-white leading-none">{PROFESIONAL.horasMes}</p>
                    <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-2">Horas totales</p>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--color-on-surface-variant)]/50 mt-auto pt-4 border-t border-white/5">
                  Este acumulado se reporta automáticamente a administración al cierre del mes.
                </p>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ── Info profesional ── */}
        <Reveal delay={0.16}>
          <Card padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">workspace_premium</span>
              <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                Perfil profesional
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: 'pool', label: 'Especialidad', value: PROFESIONAL.especialidad },
                { icon: 'timeline', label: 'Experiencia', value: PROFESIONAL.experiencia },
                { icon: 'verified', label: 'Certificación', value: PROFESIONAL.certificacion },
              ].map((d) => (
                <div key={d.label} className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.03]">
                  <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/60 text-[20px] shrink-0">{d.icon}</span>
                  <div className="min-w-0">
                    <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-1">{d.label}</p>
                    <p className="text-sm text-white">{d.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        {/* ── Salud y seguridad ── */}
        <Reveal delay={0.2}>
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
