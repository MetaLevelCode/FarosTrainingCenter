'use client'

// ============================================================
// FAROS — Registro de estudiantes
// Crea cuenta en Firebase Auth + documento en Firestore.
// Solo escribe los campos del whitelist de firestore.rules.
// ============================================================

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Input, FarosWordmark } from '@/components/ui'
import { WaterBackground } from '@/components/shared/WaterBackground'

const SEDES = ['UTP', 'Comfamiliar', 'Otra']

export default function RegistroPage() {
  const router = useRouter()
  const { signUp } = useAuth()

  const [nombres, setNombres] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [cedula, setCedula] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [telefono, setTelefono] = useState('')
  const [eps, setEps] = useState('')
  const [sede, setSede] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!nombres.trim()) e.nombres = 'Escribe tu nombre.'
    if (!apellidos.trim()) e.apellidos = 'Escribe tus apellidos.'
    if (!cedula.trim()) e.cedula = 'Escribe tu número de documento.'
    if (!email.includes('@')) e.email = 'Correo inválido.'
    if (password.length < 6) e.password = 'Mínimo 6 caracteres.'
    if (password !== confirmar) e.confirmar = 'Las contraseñas no coinciden.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validar()) return

    setLoading(true)
    const res = await signUp(email, password, nombres.trim(), apellidos.trim(), cedula.trim(), 'estudiante', {
      telefono: telefono.trim() || undefined,
      eps: eps.trim() || undefined,
      sede: sede || undefined,
    })
    setLoading(false)

    if (res.ok) {
      router.replace('/dashboard')
    } else {
      setError(res.error ?? 'No se pudo crear la cuenta.')
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5 py-12 relative">
      <WaterBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-[480px]"
      >
        <div className="flex items-center justify-between mb-8">
          <Link href="/" aria-label="Volver al inicio">
            <FarosWordmark />
          </Link>
          <Link
            href="/login"
            className="label-caps text-[10px] text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-fixed)] transition-colors"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <p className="label-caps text-[10px] text-[var(--color-primary-fixed)] mb-3">Únete a Faros</p>
        <h1 className="font-display text-3xl font-black text-white uppercase tracking-tighter mb-2">
          Crear cuenta
        </h1>
        <p className="text-[var(--color-on-surface-variant)] text-sm mb-8">
          Completa tus datos para empezar a entrenar.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Nombres"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Carlos"
                autoComplete="given-name"
                required
              />
              {errores.nombres && <p className="text-[10px] text-[var(--color-danger-crimson)] mt-1">{errores.nombres}</p>}
            </div>
            <div>
              <Input
                label="Apellidos"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="Méndez"
                autoComplete="family-name"
                required
              />
              {errores.apellidos && <p className="text-[10px] text-[var(--color-danger-crimson)] mt-1">{errores.apellidos}</p>}
            </div>
          </div>

          <div>
            <Input
              label="Número de documento"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="1088301457"
              inputMode="numeric"
              required
            />
            {errores.cedula && <p className="text-[10px] text-[var(--color-danger-crimson)] mt-1">{errores.cedula}</p>}
          </div>

          <div>
            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              required
            />
            {errores.email && <p className="text-[10px] text-[var(--color-danger-crimson)] mt-1">{errores.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              {errores.password && <p className="text-[10px] text-[var(--color-danger-crimson)] mt-1">{errores.password}</p>}
            </div>
            <div>
              <Input
                label="Confirmar contraseña"
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              {errores.confirmar && <p className="text-[10px] text-[var(--color-danger-crimson)] mt-1">{errores.confirmar}</p>}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 space-y-4">
            <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">Datos opcionales</p>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Teléfono"
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+57 310 000 0000"
                autoComplete="tel"
              />
              <Input
                label="EPS"
                value={eps}
                onChange={(e) => setEps(e.target.value)}
                placeholder="Nueva EPS"
              />
            </div>

            <div>
              <label className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/70 mb-2 block">Sede</label>
              <select
                value={sede}
                onChange={(e) => setSede(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors"
              >
                <option value="" className="bg-[#0a0a0a]">Selecciona tu sede</option>
                {SEDES.map((s) => (
                  <option key={s} value={s} className="bg-[#0a0a0a]">{s}</option>
                ))}
              </select>
            </div>
          </div>

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
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
