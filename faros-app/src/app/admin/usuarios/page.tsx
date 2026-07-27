'use client'

// ============================================================
// FAROS — Admin · Usuarios
// Requisitos (notas ④): ver los usuarios, ver qué ciclos dio
// cada profe. Directorio global con búsqueda, filtro por rol/
// estado y acción de activar / suspender.
// ============================================================

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import { ROSTER, describirPlan } from '@/lib/planes'

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

type Rol = 'todos' | 'alumno' | 'entrenador'
type Estado = 'Activo' | 'Suspendido'

type Usuario = {
  id: string
  nombre: string
  rol: 'alumno' | 'entrenador'
  detalle: string
  documento: string
  ciclos: number
  estado: Estado
}

// Atletas derivados del roster compartido: el detalle es su PLAN real
// (el mismo que ve el alumno en su dashboard y el coach en su portal).
const ATLETAS: Usuario[] = ROSTER.map((a) => ({
  id: a.id,
  nombre: a.nombre,
  rol: 'alumno' as const,
  detalle: describirPlan(a.plan).etiqueta,
  documento: a.documento,
  ciclos: a.plan.estado === 'vencido' ? 1 : 3,
  estado: a.estadoCuenta,
}))

const STAFF: Usuario[] = [
  { id: 'FR-C002', nombre: 'Ana Torres', rol: 'entrenador', detalle: 'Velocidad y técnica', documento: 'C.C. 1.093.774.210', ciclos: 12, estado: 'Activo' },
  { id: 'FR-C005', nombre: 'Felipe Cárdenas', rol: 'entrenador', detalle: 'Resistencia · Auxiliar', documento: 'C.C. 1.087.902.336', ciclos: 8, estado: 'Activo' },
]

const USUARIOS_INICIALES: Usuario[] = [...ATLETAS, ...STAFF]

function ini(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function UsuariosPage() {
  const { authorized, loading } = useRoleGuard(['admin'])
  const [usuarios, setUsuarios] = useState(USUARIOS_INICIALES)
  const [rol, setRol] = useState<Rol>('todos')
  const [busqueda, setBusqueda] = useState('')

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return usuarios.filter((u) => {
      const okRol = rol === 'todos' || u.rol === rol
      const okQ = !q || u.nombre.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || u.documento.toLowerCase().includes(q)
      return okRol && okQ
    })
  }, [usuarios, rol, busqueda])

  const totalAlumnos = usuarios.filter((u) => u.rol === 'alumno').length
  const totalEntrenadores = usuarios.filter((u) => u.rol === 'entrenador').length
  const suspendidos = usuarios.filter((u) => u.estado === 'Suspendido').length

  function toggleEstado(id: string) {
    setUsuarios((prev) => prev.map((u) =>
      u.id === id ? { ...u, estado: u.estado === 'Activo' ? 'Suspendido' : 'Activo' } : u,
    ))
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Usuarios">
      <div className="space-y-8">

        {/* ── Header ── */}
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Directorio global</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Usuarios
            </h2>
          </div>
        </Reveal>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: String(usuarios.length), tone: 'white' },
            { label: 'Atletas', value: String(totalAlumnos), tone: 'white' },
            { label: 'Entrenadores', value: String(totalEntrenadores), tone: 'primary' },
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

        {/* ── Directorio ── */}
        <Reveal delay={0.16}>
          <Card padding="none" className="overflow-hidden">
            <div className="p-6 md:p-8 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02]">
              <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl w-fit" role="group" aria-label="Rol">
                {([['todos', 'Todos'], ['alumno', 'Atletas'], ['entrenador', 'Staff']] as const).map(([key, label]) => (
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
                  placeholder="Buscar por nombre, ID o documento..."
                  aria-label="Buscar usuario"
                  className="bg-white/5 border border-white/10 rounded-full pl-11 pr-5 py-3 text-xs w-full md:w-80 text-white placeholder:text-white/20 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors duration-300"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[760px]">
                <thead className="bg-white/5">
                  <tr>
                    {['Usuario', 'Documento', 'Rol', 'Ciclos', 'Estado', 'Acción'].map((h) => (
                      <th key={h} className={`px-6 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 ${h === 'Acción' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {visibles.map((u) => {
                    const activo = u.estado === 'Activo'
                    return (
                      <tr key={u.id} className="hover:bg-white/[0.03] transition-colors duration-200">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 border ${
                              u.rol === 'entrenador'
                                ? 'bg-[rgba(230,255,0,0.12)] text-[var(--color-primary-fixed)] border-[rgba(230,255,0,0.3)]'
                                : 'bg-white/10 text-white border-white/10'
                            }`}>
                              {ini(u.nombre)}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-white">{u.nombre}</p>
                              <p className="text-[10px] text-[var(--color-on-surface-variant)]/40 font-bold">{u.detalle}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-[var(--color-on-surface-variant)]/70 whitespace-nowrap">{u.documento}</td>
                        <td className="px-6 py-4">
                          <Badge variant={u.rol === 'entrenador' ? 'primary' : 'default'}>
                            {u.rol === 'entrenador' ? 'Entrenador' : 'Atleta'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-display font-black text-white">{u.ciclos}</span>
                          <span className="text-[10px] text-[var(--color-on-surface-variant)]/40 ml-1">
                            {u.rol === 'entrenador' ? 'dictados' : 'cursados'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={activo ? 'success' : 'danger'}>{u.estado}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            variant={activo ? 'ghost' : 'primary'}
                            onClick={() => toggleEstado(u.id)}
                          >
                            {activo ? 'Suspender' : 'Reactivar'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-[var(--color-on-surface-variant)]/60">
                        Ningún usuario coincide con la búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      </div>
    </GuardedShell>
  )
}
