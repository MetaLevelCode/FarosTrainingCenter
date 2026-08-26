'use client'

// ============================================================
// FAROS — Admin · Usuarios
// Lee de Firestore colección `usuarios`. Activa / suspende
// escribiendo el campo `activo` en el documento del usuario.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
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
  const [selectedUser, setSelectedUser] = useState<Usuario & { activo?: boolean } | null>(null)

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
                    {['Usuario', 'Cédula', 'Rol', 'Sede', 'Plan Activo', 'Estado', 'Acción'].map((h) => (
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
                      <tr 
                        key={u.uid} 
                        className="hover:bg-white/[0.03] transition-colors duration-200 cursor-pointer"
                        onClick={() => setSelectedUser(u)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-black shrink-0 border ${
                              u.rol === 'profesor'
                                ? 'bg-[rgba(230,255,0,0.12)] text-[var(--color-primary-fixed)] border-[rgba(230,255,0,0.3)]'
                                : u.rol === 'admin'
                                  ? 'bg-white/20 text-white border-white/20'
                                  : 'bg-white/10 text-white border-white/10'
                            }`}>
                              {u.foto_perfil ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.foto_perfil} alt="" className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                ini(u)
                              )}
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
                          {u.suscripcionActiva ? (
                            <div>
                              <p className="text-[11px] font-bold text-white leading-tight">
                                {u.suscripcionActiva.nombrePlan}
                              </p>
                              {u.suscripcionActiva.estado === 'activa' ? (
                                <p className="label-caps text-[9px] text-[var(--color-primary-fixed)]/80 mt-1">
                                  {u.suscripcionActiva.sesionesRestantes} sesiones
                                </p>
                              ) : (
                                <p className="label-caps text-[9px] text-[var(--color-danger-crimson)] mt-1">
                                  Vencido
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/40">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={activo ? 'success' : 'danger'}>{activo ? 'Activo' : 'Suspendido'}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
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

      {/* ── Modal de Detalle de Usuario ── */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedUser && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedUser(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl z-10"
            >
              <div className="p-6 md:p-8 space-y-8">
                {/* Cabecera */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-5">
                    <span className={`relative w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-black shrink-0 border ${
                      selectedUser.rol === 'profesor'
                        ? 'bg-[rgba(230,255,0,0.12)] text-[var(--color-primary-fixed)] border-[rgba(230,255,0,0.3)]'
                        : selectedUser.rol === 'admin'
                          ? 'bg-white/20 text-white border-white/20'
                          : 'bg-white/10 text-white border-white/10'
                    }`}>
                      {selectedUser.foto_perfil ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedUser.foto_perfil} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        ini(selectedUser)
                      )}
                    </span>
                    <div>
                      <h3 className="font-display text-2xl font-black text-white leading-tight uppercase">
                        {nombreCompleto(selectedUser)}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant={selectedUser.rol === 'profesor' ? 'primary' : selectedUser.rol === 'admin' ? 'default' : 'default'}>
                          {selectedUser.rol === 'profesor' ? 'Profesor' : selectedUser.rol === 'admin' ? 'Admin' : 'Estudiante'}
                        </Badge>
                        <Badge variant={selectedUser.activo !== false ? 'success' : 'danger'}>
                          {selectedUser.activo !== false ? 'Activo' : 'Suspendido'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/20 transition-all shrink-0"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Identidad y Contacto */}
                  <div className="space-y-4">
                    <h4 className="label-caps text-[10px] text-[var(--color-primary-fixed)] border-b border-[rgba(230,255,0,0.15)] pb-2">Identidad & Contacto</h4>
                    <div className="space-y-3 text-sm">
                      <div><span className="text-[var(--color-on-surface-variant)]/60 text-xs block mb-0.5">Cédula</span><span className="text-white font-medium">{selectedUser.cedula || '—'}</span></div>
                      <div><span className="text-[var(--color-on-surface-variant)]/60 text-xs block mb-0.5">Email</span><span className="text-white font-medium">{selectedUser.email}</span></div>
                      <div><span className="text-[var(--color-on-surface-variant)]/60 text-xs block mb-0.5">Sede</span><span className="text-white font-medium capitalize">{selectedUser.sede || '—'}</span></div>
                      <div><span className="text-[var(--color-on-surface-variant)]/60 text-xs block mb-0.5">Teléfono</span><span className="text-white font-medium">{selectedUser.telefono || '—'}</span></div>
                      <div><span className="text-[var(--color-on-surface-variant)]/60 text-xs block mb-0.5">Emergencia</span><span className="text-white font-medium">{selectedUser.telefonoEmergencia || '—'}</span></div>
                    </div>
                  </div>

                  {/* Suscripción */}
                  <div className="space-y-4">
                    <h4 className="label-caps text-[10px] text-[var(--color-primary-fixed)] border-b border-[rgba(230,255,0,0.15)] pb-2">Plan Activo</h4>
                    {selectedUser.suscripcionActiva ? (
                      <div className="bg-[rgba(230,255,0,0.03)] border border-[rgba(230,255,0,0.1)] rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-bold text-base">{selectedUser.suscripcionActiva.nombrePlan}</span>
                          <Badge variant={selectedUser.suscripcionActiva.estado === 'activa' ? 'success' : 'danger'}>
                            {selectedUser.suscripcionActiva.estado === 'activa' ? 'Activo' : 'Vencido'}
                          </Badge>
                        </div>
                        <div className="flex items-end gap-2 mt-4">
                          <span className="font-display text-4xl font-black text-[var(--color-primary-fixed)] leading-none">
                            {selectedUser.suscripcionActiva.sesionesRestantes}
                          </span>
                          <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60 mb-1">
                            / {selectedUser.suscripcionActiva.sesionesCompradas || '—'} sesiones
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-on-surface-variant)]/60 mt-3">
                          Vence: <span className="text-white font-medium">{new Date(selectedUser.suscripcionActiva.fechaVencimiento).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: '2-digit' })}</span>
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center py-8">
                        <span className="material-symbols-outlined text-white/20 text-4xl mb-2">fitness_center</span>
                        <p className="text-sm font-medium text-white/60">Sin suscripción activa</p>
                      </div>
                    )}
                  </div>

                  {/* Estadísticas */}
                  {selectedUser.rol === 'estudiante' && selectedUser.estadisticas && (
                    <div className="space-y-4 md:col-span-2 mt-2">
                      <h4 className="label-caps text-[10px] text-[var(--color-primary-fixed)] border-b border-[rgba(230,255,0,0.15)] pb-2">Asistencia (Histórico global)</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                          <span className="font-display text-2xl font-black text-white">{selectedUser.estadisticas.clasesAsistidas}</span>
                          <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-1">Asistidas</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                          <span className="font-display text-2xl font-black text-white">{selectedUser.estadisticas.clasesReservadas}</span>
                          <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-1">Reservadas</p>
                        </div>
                        <div className="bg-[rgba(230,255,0,0.05)] border border-[rgba(230,255,0,0.2)] rounded-xl p-3">
                          <span className="font-display text-2xl font-black text-[var(--color-primary-fixed)]">{selectedUser.estadisticas.tasaAsistencia}%</span>
                          <p className="label-caps text-[9px] text-[var(--color-primary-fixed)]/60 mt-1">Tasa</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Salud & Nivel */}
                  {(selectedUser.eps || selectedUser.dificultades || selectedUser.nivel) && (
                    <div className="space-y-4 md:col-span-2 mt-2">
                      <h4 className="label-caps text-[10px] text-[var(--color-primary-fixed)] border-b border-[rgba(230,255,0,0.15)] pb-2">Salud & Nivel</h4>
                      <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm">
                        {selectedUser.nivel && (
                          <div><span className="text-[var(--color-on-surface-variant)]/60 text-xs block mb-0.5">Nivel de entrenamiento</span><span className="text-white font-medium capitalize">{selectedUser.nivel}</span></div>
                        )}
                        {selectedUser.eps && (
                          <div><span className="text-[var(--color-on-surface-variant)]/60 text-xs block mb-0.5">EPS</span><span className="text-white font-medium uppercase">{selectedUser.eps}</span></div>
                        )}
                        {selectedUser.dificultades && selectedUser.dificultades.length > 0 && (
                          <div className="w-full">
                            <span className="text-[var(--color-on-surface-variant)]/60 text-xs block mb-1.5">Dificultades médicas</span>
                            <div className="flex flex-wrap gap-2">
                              {selectedUser.dificultades.map(d => (
                                <span key={d} className="px-2 py-1 bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] text-[var(--color-danger-crimson)] text-xs rounded-md">
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Footer del Modal */}
                <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between">
                  <p className="text-[10px] text-white/30">
                    ID: {selectedUser.uid} • Registrado: {selectedUser.fecha_registro ? new Date(selectedUser.fecha_registro).toLocaleDateString('es-CO') : '—'}
                  </p>
                  {selectedUser.rol !== 'admin' && (
                    <Button 
                      size="sm" 
                      variant={selectedUser.activo !== false ? 'ghost' : 'primary'}
                      onClick={() => toggleActivo(selectedUser.uid)}
                    >
                      {selectedUser.activo !== false ? 'Suspender usuario' : 'Reactivar usuario'}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </GuardedShell>
  )
}
