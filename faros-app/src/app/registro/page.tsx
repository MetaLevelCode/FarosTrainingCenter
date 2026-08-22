'use client'

// ============================================================
// FAROS — Registro de estudiantes
// Todos los campos son obligatorios excepto dificultades médicas.
// Solo escribe los campos del whitelist de firestore.rules.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Input, FarosWordmark } from '@/components/ui'
import { WaterBackground } from '@/components/shared/WaterBackground'
import { comprimirImagen } from '@/lib/imagen'
import { updateFotoPerfil, getSedes } from '@/lib/firestore'
import { getFirebase } from '@/lib/firebase'
import type { Sede } from '@/lib/types'

// Fallback si Firestore no cargó (sin conexión, o el catálogo aún no se sembró).
const SEDES_FALLBACK: Sede[] = [
  { id: 'utp', codigo: 'UTP', nombre: 'UTP', activo: true, orden: 1, creadoEn: 0 },
  { id: 'tulcan', codigo: 'TULCAN', nombre: 'Tulcán II', activo: true, orden: 2, creadoEn: 0 },
]
const TIPO_DOC = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'CE', label: 'Cédula de extranjería' },
]

const EASE = [0.23, 1, 0.32, 1] as const

function FieldError({ msg }: { msg?: string }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-[10px] text-[var(--color-danger-crimson)] mt-1"
        >
          {msg}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="label-caps text-[9px] text-[var(--color-primary-fixed)]/70 border-b border-[rgba(230,255,0,0.15)] pb-2 mb-4">
      {children}
    </p>
  )
}

export default function RegistroPage() {
  const router = useRouter()
  const { signUp } = useAuth()

  // Identidad
  const [nombres, setNombres] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [tipoDoc, setTipoDoc] = useState('CC')
  const [cedula, setCedula] = useState('')

  // Contacto
  const [telefono, setTelefono] = useState('')
  const [telefonoEmergencia, setTelefonoEmergencia] = useState('')
  const [sede, setSede] = useState('')
  const [sedes, setSedes] = useState<Sede[]>([])

  useEffect(() => {
    getSedes(true)
      .then((s) => setSedes(s.length > 0 ? s : SEDES_FALLBACK))
      .catch(() => setSedes(SEDES_FALLBACK))
  }, [])

  // Salud
  const [eps, setEps] = useState('')
  const [dificultades, setDificultades] = useState('')

  // Cuenta
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')

  // Foto de perfil (opcional) — se sube después de crear la cuenta.
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})

  function elegirFoto(file: File) {
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!nombres.trim()) e.nombres = 'Campo obligatorio.'
    if (!apellidos.trim()) e.apellidos = 'Campo obligatorio.'
    if (!cedula.trim()) e.cedula = 'Campo obligatorio.'
    if (!telefono.trim()) e.telefono = 'Campo obligatorio.'
    if (!telefonoEmergencia.trim()) e.telefonoEmergencia = 'Campo obligatorio.'
    if (!sede) e.sede = 'Selecciona tu sede.'
    if (!eps.trim()) e.eps = 'Campo obligatorio.'
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

    const dificultadesArr = dificultades.trim()
      ? dificultades.split(',').map((d) => d.trim()).filter(Boolean)
      : []

    setLoading(true)
    const res = await signUp(
      email.trim(), password,
      nombres.trim(), apellidos.trim(), cedula.trim(),
      'estudiante',
      {
        telefono: telefono.trim(),
        telefonoEmergencia: telefonoEmergencia.trim(),
        eps: eps.trim(),
        sede,
        dificultades: dificultadesArr.length ? dificultadesArr : undefined,
      },
    )
    if (res.ok && fotoFile) {
      // Best-effort: si falla, la cuenta ya quedó creada — el alumno
      // puede subir la foto después desde su perfil.
      try {
        const [{ auth, storage }, { ref, uploadBytes, getDownloadURL }] = await Promise.all([
          getFirebase(), import('firebase/storage'),
        ])
        const uid = auth.currentUser?.uid
        if (uid) {
          const blob = await comprimirImagen(fotoFile)
          const storageRef = ref(storage, `perfiles/${uid}/avatar.jpg`)
          await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
          const url = await getDownloadURL(storageRef)
          await updateFotoPerfil(uid, url)
        }
      } catch (err) {
        console.error('No se pudo subir la foto de perfil:', err)
      }
    }

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
        transition={{ duration: 0.5, ease: EASE }}
        className="w-full max-w-[520px]"
      >
        {/* Header */}
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
          Completa todos tus datos para empezar a entrenar.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* ── Datos personales ── */}
          <div className="space-y-4">
            <SectionLabel>Datos personales</SectionLabel>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white/5 border border-dashed border-white/15 hover:border-[rgba(230,255,0,0.4)] transition-colors flex items-center justify-center shrink-0"
              >
                {fotoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-white/30 text-[24px]">add_a_photo</span>
                )}
              </button>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) elegirFoto(f) }}
              />
              <div>
                <p className="text-sm text-white font-semibold">Foto de perfil</p>
                <p className="text-[10px] text-[var(--color-on-surface-variant)]/50">Opcional — puedes agregarla después</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label="Nombres *" value={nombres} onChange={(e) => setNombres(e.target.value)} placeholder="Carlos" autoComplete="given-name" />
                <FieldError msg={errores.nombres} />
              </div>
              <div>
                <Input label="Apellidos *" value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Méndez" autoComplete="family-name" />
                <FieldError msg={errores.apellidos} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/70 mb-2 block">Tipo de documento *</label>
                <select
                  value={tipoDoc}
                  onChange={(e) => setTipoDoc(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors"
                >
                  {TIPO_DOC.map((t) => (
                    <option key={t.value} value={t.value} className="bg-[#0a0a0a]">{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Input label="Número de documento *" value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="1088301457" inputMode="numeric" />
                <FieldError msg={errores.cedula} />
              </div>
            </div>
          </div>

          {/* ── Contacto ── */}
          <div className="space-y-4">
            <SectionLabel>Contacto</SectionLabel>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label="Teléfono *" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+57 310 000 0000" autoComplete="tel" />
                <FieldError msg={errores.telefono} />
              </div>
              <div>
                <Input label="Teléfono de emergencia *" type="tel" value={telefonoEmergencia} onChange={(e) => setTelefonoEmergencia(e.target.value)} placeholder="+57 312 000 0000" />
                <FieldError msg={errores.telefonoEmergencia} />
              </div>
            </div>

            <div>
              <label className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/70 mb-2 block">Sede *</label>
              <select
                value={sede}
                onChange={(e) => setSede(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors"
              >
                <option value="" className="bg-[#0a0a0a]">Selecciona tu sede</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.codigo} className="bg-[#0a0a0a]">{s.nombre}</option>
                ))}
              </select>
              <FieldError msg={errores.sede} />
            </div>
          </div>

          {/* ── Salud ── */}
          <div className="space-y-4">
            <SectionLabel>Información de salud</SectionLabel>

            <div>
              <Input label="EPS *" value={eps} onChange={(e) => setEps(e.target.value)} placeholder="Nueva EPS" />
              <FieldError msg={errores.eps} />
            </div>

            <div>
              <label className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/70 mb-2 block">
                Dificultades médicas <span className="text-[var(--color-on-surface-variant)]/40">(opcional — separa por comas)</span>
              </label>
              <textarea
                value={dificultades}
                onChange={(e) => setDificultades(e.target.value)}
                placeholder="Ej: asma, escoliosis leve"
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>

          {/* ── Cuenta ── */}
          <div className="space-y-4">
            <SectionLabel>Credenciales de acceso</SectionLabel>

            <div>
              <Input label="Correo electrónico *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" />
              <FieldError msg={errores.email} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label="Contraseña *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                <FieldError msg={errores.password} />
              </div>
              <div>
                <Input label="Confirmar contraseña *" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                <FieldError msg={errores.confirmar} />
              </div>
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

          <Button type="submit" size="lg" fullWidth loading={loading}>
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
