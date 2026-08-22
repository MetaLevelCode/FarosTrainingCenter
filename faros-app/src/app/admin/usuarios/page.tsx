'use client'

// ============================================================
// FAROS — Admin · Usuarios
// Lee de Firestore colección `usuarios`. Activa / suspende
// escribiendo el campo `activo` en el documento del usuario.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import { getUsuarios, setUsuarioActivo, setUsuarioRol } from '@/lib/firestore'
import type { Usuario, UserRole } from '@/lib/types'

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

type FiltroRol = 'todos' | 'estudiante' | 'profesor'

function ini(u: Usuario) {
  return `${u.nombres.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase()
}

function nombreCompleto(u: Usuario) {
  return `${u.nombres} ${u.apellidos}`
}

export default function UsuariosPage() {
  const { authorized, loading } = useRoleGuard(['admin'])
  const [usuarios, setUsuarios] = useState<(Usuario & { activo?: boolean })[]>([])
  const [cargando, setCargando] = useState(true)
  const [rol, setRol] = useState<FiltroRol>('todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    getUsuarios()
      .then((us) => {
        setUsuarios(us.map((u) => ({ ...u, activo: (u as any).activo !== false })))
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return usuarios.filter((u) => {
      const okRol = rol === 'todos' || u.rol === rol
      const nombre = nombreCompleto(u).toLowerCase()
      const okQ = !q || nombre.includes(q) || u.cedula?.includes(q) || u.email.includes(q)
      return okRol && okQ
    })
  }, [usuarios, rol, busqueda])

  const totalEstudiantes = usuarios.filter((u) => u.rol === 'estudiante').length
  const totalProfesores = usuarios.filter((u) => u.rol === 'profesor').length
  const suspendidos = usuarios.filter((u) => u.activo === false).length

  async function toggleActivo(uid: string) {
    const u = usuarios.find((x) => x.uid === uid)
    if (!u) return
    const nuevoActivo = !(u.activo !== false)
    const nombre = `${u.nombres} ${u.apellidos}`.trim() || u.email
    const accion = nuevoActivo ? 'reactivar' : 'suspender'
    if (!window.confirm(`¿${accion === 'suspender' ? 'Suspender' : 'Reactivar'} a "${nombre}"?\n\n${
      accion === 'suspender'
        ? 'No podrá iniciar sesión ni realizar acciones hasta que lo reactives.'
        : 'Recuperará acceso completo.'
    }`)) return
    setUsuarios((prev) => prev.map((x) => x.uid === uid ? { ...x, activo: nuevoActivo } : x))
    try {
      await setUsuarioActivo(uid, nuevoActivo)
    } catch (e: any) {
      setUsuarios((prev) => prev.map((x) => x.uid === uid ? { ...x, activo: !nuevoActivo } : x))
      alert(e?.message ?? `No se pudo ${accion} al usuario.`)
    }
  }

  async function cambiarRol(uid: string, nuevoRol: UserRole) {
    const u = usuarios.find((x) => x.uid === uid)
    if (!u || u.rol === nuevoRol) return
    const nombre = `${u.nombres} ${u.apellidos}`.trim() || u.email
    if (!window.confirm(
      `¿Cambiar el rol de "${nombre}" de ${u.rol} a ${nuevoRol}?\n\n` +
      `Esto altera los permisos de la cuenta en toda la app.`,
    )) return
    setUsuarios((prev) => prev.map((x) => x.uid === uid ? { ...x, rol: nuevoRol } : x))
    try {
      await setUsuarioRol(uid, nuevoRol)
    } catch (e: any) {
      setUsuarios((prev) => prev.map((x) => x.uid === uid ? { ...x, rol: u.rol } : x))
      alert(e?.message ?? 'No se pudo cambiar el rol.')
    }
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Usuarios">
      <div className="space-y-8">

        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Directorio global</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Usuarios
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: String(usuarios.length), tone: 'white' },
            { label: 'Estudiantes', value: String(totalEstudiantes), tone: 'white' },
            { label: 'Profesores', value: String(totalProfesores), tone: 'primary' },
            { label: 'Suspendidos', value: String(suspendidos), tone: 'danger' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={0.05 * i}>
              <Card>
                <p className={`font-display text-3xl font-black leading-none ${
                  s.tone === 'primary' ? 'text-[var(--color-primary-fixed)]'
                  : s.tone === 'danger' ? 'text-[var(--color-danger-crimson)]' : 'text-white'
                }`}>{s.value}</p>
                <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-2">{s.label}</p>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.16}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02]">
              <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl w-fit" role="group" aria-label="Rol">
                {([['todos', 'Todos'], ['estudiante', 'Estudiantes'], ['profesor', 'Profesores']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setRol(key)}
                    aria-pressed={rol === key}
                    className={`px-4 py-2 text-[10px] font-black rounded-lg uppercase tracking-widest transition-colors duration-200 ${
                      rol === key ? 'bg-[var(--color-primary-fixed)] text-black' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-lg pointer-events-none">search</span>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, cédula o email..."
                  aria-label="Buscar usuario"
                  className="bg-white/5 border border-white/10 rounded-full pl-11 pr-5 py-3 text-xs w-full md:w-80 text-white placeholder:text-white/20 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors duration-300"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[760px]">
                <thead className="bg-white/5">
                  <tr>
                    {['Usuario', 'Cédula', 'Rol', 'Sede', 'Estado', 'Acción'].map((h) => (
                      <th key={h} className={`px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 ${h === 'Acción' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cargando ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-[var(--color-on-surface-variant)]/40">
                        Cargando usuarios…
                      </td>
                    </tr>
                  ) : visibles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-[var(--color-on-surface-variant)]/60">
                        {usuarios.length === 0 ? 'No hay usuarios registrados aún.' : 'Ningún usuario coincide con la búsqueda.'}
                      </td>
                    </tr>
                  ) : visibles.map((u) => {
                    const activo = u.activo !== false
                    return (
                      <tr key={u.uid} className="hover:bg-white/[0.03] transition-colors duration-200">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 border ${
                              u.rol === 'profesor'
                                ? 'bg-[rgba(230,255,0,0.12)] text-[var(--color-primary-fixed)] border-[rgba(230,255,0,0.3)]'
                                : u.rol === 'admin'
                                  ? 'bg-white/20 text-white border-white/20'
                                  : 'bg-white/10 text-white border-white/10'
                            }`}>
                              {ini(u)}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-white">{nombreCompleto(u)}</p>
                              <p className="text-[10px] text-[var(--color-on-surface-variant)]/40 font-bold">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-[var(--color-on-surface-variant)]/70 whitespace-nowrap">{u.cedula || '—'}</td>
                        <td className="px-6 py-4">
                          <Badge variant={u.rol === 'profesor' ? 'primary' : u.rol === 'admin' ? 'default' : 'default'}>
                            {u.rol === 'profesor' ? 'Profesor' : u.rol === 'admin' ? 'Admin' : 'Estudiante'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/70">{u.sede || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={activo ? 'success' : 'danger'}>{activo ? 'Activo' : 'Suspendido'}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {u.rol !== 'admin' && (
                            <div className="flex items-center gap-2 justify-end">
                              <select
                                value={u.rol}
                                onChange={(e) => cambiarRol(u.uid, e.target.value as UserRole)}
                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-[var(--color-on-surface-variant)] focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors cursor-pointer"
                              >
                                <option value="estudiante" className="bg-[#0a0a0a]">Estudiante</option>
                                <option value="profesor" className="bg-[#0a0a0a]">Profesor</option>
                              </select>
                              <Button
                                size="sm"
                                variant={activo ? 'ghost' : 'primary'}
                                onClick={() => toggleActivo(u.uid)}
                              >
                                {activo ? 'Suspender' : 'Reactivar'}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
