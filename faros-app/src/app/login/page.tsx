'use client'

// ============================================================
// FAROS — Login
// Split layout: cinematic brand video (left) + form (right).
// The horizontal video shows the Faros lighthouse logo forming.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Input, FarosWordmark } from '@/components/ui'
import { WaterBackground } from '@/components/shared/WaterBackground'

const ROLE_HOME: Record<string, string> = {
  alumno: '/dashboard', entrenador: '/portal', admin: '/admin',
}

export default function LoginPage() {
  const router = useRouter()
  const { signIn, error, clearError, isMockMode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setLoading(true)
    const res = await signIn(email, password)
    setLoading(false)
    if (res.ok && res.role) router.replace(ROLE_HOME[res.role] ?? '/dashboard')
  }

  const demos = [
    { label: 'Alumno', email: 'alumno@faros.com' },
    { label: 'Entrenador', email: 'entrenador@faros.com' },
    { label: 'Admin', email: 'admin@faros.com' },
  ]

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2 relative">
      <WaterBackground />

      {/* ── LEFT: Cinematic brand video ── */}
      <div className="relative hidden lg:flex items-center justify-center overflow-hidden border-r border-[var(--color-surface-stroke)]">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay muted loop playsInline
          poster="/media/hero-poster.jpg"
        >
          <source src="/media/hero-horizontal.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/40 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#050505]/60 pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 self-end p-12 w-full"
        >
          <p className="label-caps text-[var(--color-primary-fixed)] mb-4 tracking-[0.25em]">
            Elite Swimming Platform
          </p>
          <h2 className="font-display text-5xl font-black text-white uppercase tracking-tighter leading-[0.95] mb-4">
            El agua no<br />recuerda tus<br />excusas.
          </h2>
          <p className="text-[var(--color-on-surface-variant)] text-sm max-w-sm">
            Solo tus tiempos. Entrena con datos, compite con propósito.
          </p>
        </motion.div>
      </div>

      {/* ── RIGHT: Login form ── */}
      <div className="flex items-center justify-center px-5 py-10 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile: inline video header */}
          <div className="lg:hidden mb-8 rounded-3xl overflow-hidden relative aspect-video border border-[var(--color-surface-stroke)]">
            <video
              className="w-full h-full object-cover"
              autoPlay muted loop playsInline
              poster="/media/hero-poster.jpg"
            >
              <source src="/media/hero-horizontal.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
            <div className="absolute bottom-4 left-4">
              <FarosWordmark size="sm" />
            </div>
          </div>

          <div className="hidden lg:block mb-8">
            <FarosWordmark />
          </div>

          <p className="label-caps text-[10px] text-[var(--color-primary-fixed)] mb-3">
            Acceso de atletas
          </p>
          <h1 className="font-display text-3xl font-black text-white uppercase tracking-tighter mb-2">
            Bienvenido
          </h1>
          <p className="text-[var(--color-on-surface-variant)] text-sm mb-8">
            Inicia sesión para continuar entrenando.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Correo" type="email" placeholder="tu@correo.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email"
            />
            <Input
              label="Contraseña" type="password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required autoComplete="current-password"
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-[var(--color-danger-crimson)] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-xl px-4 py-2.5"
              >
                {error}
              </motion.p>
            )}

            <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
              {loading ? 'Entrando…' : 'Iniciar sesión'}
            </Button>
          </form>

          {isMockMode && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Modo demo</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {demos.map((d) => (
                  <Button
                    key={d.email} variant="ghost" size="sm"
                    onClick={() => { setEmail(d.email); setPassword('123456') }}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
