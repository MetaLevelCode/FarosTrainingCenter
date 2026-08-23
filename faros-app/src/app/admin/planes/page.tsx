'use client'

// ============================================================
// FAROS — Admin · Catálogo
// El admin edita AQUÍ el catálogo que alimenta el wizard del alumno.
//
// Cuatro pestañas:
//   Sedes      — CRUD de sedes físicas (Firestore: sedes/)
//   Grupos     — CRUD de grupos grupales por sede (Firestore: grupos/)
//   Tarifas    — Matriz de precios (Firestore: tarifas/actual)
//   Plantillas — Planes nombrados ad-hoc (Firestore: planes/) legacy
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button, Spinner } from '@/components/ui'
import { fmtCOP } from '@/lib/planes'
import {
  getSedes, upsertSede, eliminarSede,
  getGrupos, upsertGrupo, eliminarGrupo,
  getTarifas, actualizarTarifas,
  getPlanes, crearPlan, actualizarPlan, archivarPlan,
} from '@/lib/firestore'
import type { Sede, Grupo, Tarifas, Plan } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'

const EASE = [0.22, 1, 0.36, 1] as const

// Serializa un error Firebase/JS a texto legible con code y mensaje.
function errStr(e: any): string {
  if (!e) return 'error sin info'
  const parts: string[] = []
  if (e.code) parts.push(`[${e.code}]`)
  if (e.message) parts.push(e.message)
  else parts.push(String(e))
  return parts.join(' ')
}

function BannerError({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  if (!error) return null
  return (
    <div
      role="alert"
      className="rounded-xl border p-4 flex items-start gap-3"
      style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)' }}
    >
      <span className="material-symbols-outlined text-[20px] shrink-0" style={{ color: '#ef4444' }}>error</span>
      <div className="flex-1 min-w-0">
        <p className="font-display font-black text-white text-sm mb-1">Escritura fallida</p>
        <p className="text-[11px] font-mono text-white/80 break-all">{error}</p>
      </div>
      <button onClick={onDismiss} className="text-white/60 hover:text-white text-lg leading-none">×</button>
    </div>
  )
}

async function probarFirestore(): Promise<{ ok: boolean; detalle: string }> {
  try {
    const { getAuth } = await import('firebase/auth')
    const token = await getAuth().currentUser?.getIdToken()
    if (!token) return { ok: false, detalle: 'No hay sesión activa' }
    const res = await fetch('/api/health/firestore', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, detalle: `HTTP ${res.status}: ${data.error ?? 'error'}` }
    return { ok: true, detalle: `OK — write+read+delete en ${data.duration_ms}ms` }
  } catch (e: any) {
    return { ok: false, detalle: errStr(e) }
  }
}

function BotonHealthCheck() {
  const [estado, setEstado] = useState<'idle' | 'trabajando' | 'ok' | 'fail'>('idle')
  const [detalle, setDetalle] = useState<string>('')
  async function probar() {
    setEstado('trabajando'); setDetalle('')
    const r = await probarFirestore()
    setEstado(r.ok ? 'ok' : 'fail')
    setDetalle(r.detalle)
  }
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={probar}
        disabled={estado === 'trabajando'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.03] text-white text-[11px] font-semibold hover:bg-white/[0.08] disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[14px]">bug_report</span>
        {estado === 'trabajando' ? 'Probando…' : 'Diagnóstico Firestore'}
      </button>
      {detalle && (
        <span className={`text-[11px] font-mono ${estado === 'ok' ? 'text-[var(--color-success-emerald)]' : 'text-[var(--color-danger-crimson)]'}`}>
          {detalle}
        </span>
      )}
    </div>
  )
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >{children}</motion.div>
  )
}

// ── Inputs reutilizables ───────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="label-caps text-[10px] text-[var(--color-on-surface-variant)]">{label}</label>
      {children}
      {hint && <span className="text-[10px] text-[var(--color-on-surface-variant)]/50">{hint}</span>}
    </div>
  )
}

function InputText(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white ' +
        'placeholder:text-white/20 focus:border-[rgba(230,255,0,0.5)] focus:outline-none ' +
        (props.className ?? '')
      }
    />
  )
}

function InputPrecio({ value, onChange, placeholder }: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <input
        type="number"
        min={0}
        step={1000}
        inputMode="numeric"
        value={value ?? ''}
        placeholder={placeholder ?? 'Por confirmar'}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
      />
      <span className="text-[10px] text-[var(--color-on-surface-variant)]/50">
        {value != null ? fmtCOP(value) : '—'}
      </span>
    </div>
  )
}

// ── Tabs ────────────────────────────────────────────────────

type Tab = 'sedes' | 'grupos' | 'tarifas' | 'plantillas'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'sedes',      label: 'Sedes',      icon: 'location_on' },
  { id: 'grupos',     label: 'Grupos',     icon: 'groups' },
  { id: 'tarifas',    label: 'Tarifas',    icon: 'payments' },
  { id: 'plantillas', label: 'Plantillas', icon: 'database' },
]

export default function CatalogoPage() {
  const { authorized, loading } = useRoleGuard(['admin'])
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('sedes')

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Catálogo">
      <div className="space-y-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Configuración</p>
              <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
                Catálogo
              </h2>
            </div>
            <BotonHealthCheck />
          </div>
        </Reveal>

        {/* Tabs */}
        <Reveal delay={0.08}>
          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-1">
            {TABS.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-white/5 text-white border-b-2 border-[var(--color-primary-fixed)]'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                  {t.label}
                </button>
              )
            })}
          </div>
        </Reveal>

        {tab === 'sedes' && <SedesTab />}
        {tab === 'grupos' && <GruposTab />}
        {tab === 'tarifas' && <TarifasTab actualizadoPor={user?.uid} />}
        {tab === 'plantillas' && <PlantillasTab />}
      </div>
    </GuardedShell>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB SEDES
// ─────────────────────────────────────────────────────────────

function SedesTab() {
  const [sedes, setSedes] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [borrador, setBorrador] = useState<Partial<Sede> | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [errorPersistente, setErrorPersistente] = useState<string | null>(null)

  useEffect(() => {
    getSedes(false).then(setSedes).catch((e) => setErrorPersistente(`Lectura falló: ${errStr(e)}`)).finally(() => setCargando(false))
  }, [])

  async function guardar(s: Partial<Sede>) {
    setErrorPersistente(null)
    const codigo = (s.codigo ?? '').trim().toUpperCase()
    const nombre = (s.nombre ?? '').trim()
    if (!codigo || !nombre) { setErrorPersistente('Código y nombre son obligatorios.'); return }
    if (!/^[A-Z0-9_-]+$/.test(codigo)) { setErrorPersistente('El código solo puede tener letras, números, guion y guion bajo.'); return }
    const id = s.id ?? codigo.toLowerCase()
    setProcesando(id)
    try {
      console.log('[SEDE_SAVE] intentando escribir', id, s)
      await upsertSede(id, {
        codigo,
        nombre,
        direccion: s.direccion?.trim() || undefined,
        activo: s.activo ?? true,
        orden: Number.isFinite(s.orden) ? (s.orden as number) : sedes.length + 1,
      })
      console.log('[SEDE_SAVE] escritura OK, releyendo')
      const fresh = await getSedes(false)
      console.log('[SEDE_SAVE] releído', fresh.length, 'sedes')
      setSedes(fresh)
      setBorrador(null)
    } catch (e: any) {
      console.error('[SEDE_SAVE] falló', e)
      setErrorPersistente(`Guardar falló: ${errStr(e)}`)
    } finally { setProcesando(null) }
  }

  async function borrar(s: Sede) {
    if (!window.confirm(`¿Eliminar la sede "${s.nombre}"?\n\nLos grupos que la referencian quedarán huérfanos.`)) return
    setErrorPersistente(null)
    setProcesando(s.id)
    try {
      await eliminarSede(s.id)
      setSedes((prev) => prev.filter((x) => x.id !== s.id))
    } catch (e: any) {
      setErrorPersistente(`Eliminar falló: ${errStr(e)}`)
    } finally { setProcesando(null) }
  }

  return (
    <div className="space-y-6">
      <BannerError error={errorPersistente} onDismiss={() => setErrorPersistente(null)} />
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">
          Sedes físicas donde se dictan clases. El código corto (ej. UTP) se usa internamente.
        </p>
        <Button size="sm" onClick={() => setBorrador({ codigo: '', nombre: '', activo: true, orden: sedes.length + 1 })}>
          <span className="material-symbols-outlined text-[16px]">add</span>
          Nueva sede
        </Button>
      </div>

      {borrador && (
        <Card>
          <p className="label-caps text-[10px] text-[var(--color-primary-fixed)] mb-4">Nueva sede</p>
          <SedeFormBody value={borrador} onChange={setBorrador} />
          <div className="flex gap-3 mt-5">
            <Button size="sm" onClick={() => guardar(borrador)} loading={procesando === (borrador.id ?? 'new')}>
              Crear
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBorrador(null)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {cargando ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          {sedes.map((s) => (
            <SedeRow key={s.id} sede={s} onGuardar={guardar} onBorrar={borrar} procesando={procesando === s.id} />
          ))}
          {sedes.length === 0 && !borrador && (
            <Card><p className="text-center text-sm text-white/50 py-8">No hay sedes. Crea la primera.</p></Card>
          )}
        </div>
      )}
    </div>
  )
}

function SedeRow({ sede, onGuardar, onBorrar, procesando }: {
  sede: Sede
  onGuardar: (s: Partial<Sede>) => Promise<void>
  onBorrar: (s: Sede) => Promise<void>
  procesando: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [draft, setDraft] = useState<Sede>(sede)

  if (!editando) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="font-display text-lg font-black text-white uppercase">{sede.nombre}</p>
              <Badge variant={sede.activo ? 'success' : 'default'}>
                {sede.activo ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Código: <span className="font-mono">{sede.codigo}</span> · Orden: {sede.orden}
              {sede.direccion && ` · ${sede.direccion}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setDraft(sede); setEditando(true) }}>Editar</Button>
            <Button size="sm" variant="danger" onClick={() => onBorrar(sede)} loading={procesando}>Eliminar</Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <SedeFormBody value={draft} onChange={(d) => setDraft(d as Sede)} />
      <div className="flex gap-3 mt-5">
        <Button
          size="sm"
          loading={procesando}
          onClick={async () => {
            // Forzar id original — protege contra derivarlo del código editado.
            await onGuardar({ ...draft, id: sede.id })
            setEditando(false)
          }}
        >
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>
      </div>
    </Card>
  )
}

function SedeFormBody({ value, onChange }: { value: Partial<Sede>; onChange: (v: Partial<Sede>) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Código *" hint="Ej: UTP, TULCAN, BAMBU">
        <InputText
          value={value.codigo ?? ''}
          onChange={(e) => onChange({ ...value, codigo: e.target.value.toUpperCase() })}
          placeholder="UTP"
        />
      </Field>
      <Field label="Nombre visible *">
        <InputText
          value={value.nombre ?? ''}
          onChange={(e) => onChange({ ...value, nombre: e.target.value })}
          placeholder="UTP"
        />
      </Field>
      <Field label="Dirección (opcional)">
        <InputText
          value={value.direccion ?? ''}
          onChange={(e) => onChange({ ...value, direccion: e.target.value })}
          placeholder="Universidad Tecnológica de Pereira"
        />
      </Field>
      <Field label="Orden">
        <InputText
          type="number"
          value={String(value.orden ?? 1)}
          onChange={(e) => onChange({ ...value, orden: Number(e.target.value) || 1 })}
        />
      </Field>
      <label className="flex items-center gap-3 text-sm text-white">
        <input
          type="checkbox"
          checked={value.activo !== false}
          onChange={(e) => onChange({ ...value, activo: e.target.checked })}
        />
        Sede activa (visible en el wizard)
      </label>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB GRUPOS
// ─────────────────────────────────────────────────────────────

function GruposTab() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [borrador, setBorrador] = useState<Partial<Grupo> | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [errorPersistente, setErrorPersistente] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getGrupos(), getSedes(false)])
      .then(([g, s]) => { setGrupos(g); setSedes(s) })
      .catch((e) => setErrorPersistente(`Lectura falló: ${errStr(e)}`))
      .finally(() => setCargando(false))
  }, [])

  async function guardar(g: Partial<Grupo>) {
    setErrorPersistente(null)
    const nombre = (g.nombre ?? '').trim()
    const sedeCodigo = (g.sedeCodigo ?? '').trim().toUpperCase()
    if (!nombre || !sedeCodigo) { setErrorPersistente('Nombre y sede son obligatorios.'); return }
    const id = g.id ?? nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    setProcesando(id)
    try {
      console.log('[GRUPO_SAVE] escribiendo', id, g)
      await upsertGrupo(id, {
        nombre,
        sedeCodigo,
        horarios: (g.horarios ?? []).filter((h) => h.trim().length > 0),
        nivel: g.nivel ?? 'Todos los niveles',
        coach: g.coach?.trim() || undefined,
        cupoMaximo: Number.isFinite(g.cupoMaximo) ? (g.cupoMaximo as number) : 12,
        disponible: g.disponible ?? true,
      })
      console.log('[GRUPO_SAVE] escritura OK')
      setGrupos(await getGrupos())
      setBorrador(null)
    } catch (e: any) {
      console.error('[GRUPO_SAVE] falló', e)
      setErrorPersistente(`Guardar falló: ${errStr(e)}`)
    } finally { setProcesando(null) }
  }

  async function borrar(g: Grupo) {
    if (!window.confirm(`¿Eliminar el grupo "${g.nombre}"?`)) return
    setErrorPersistente(null)
    setProcesando(g.id)
    try {
      await eliminarGrupo(g.id)
      setGrupos((prev) => prev.filter((x) => x.id !== g.id))
    } catch (e: any) {
      setErrorPersistente(`Eliminar falló: ${errStr(e)}`)
    } finally { setProcesando(null) }
  }

  return (
    <div className="space-y-6">
      <BannerError error={errorPersistente} onDismiss={() => setErrorPersistente(null)} />
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">
          Grupos grupales con horario fijo. Cada uno vive en una sede.
        </p>
        <Button size="sm" onClick={() => setBorrador({
          nombre: '', sedeCodigo: sedes[0]?.codigo ?? '',
          horarios: [''], nivel: 'Todos los niveles', cupoMaximo: 12, disponible: true,
        })}>
          <span className="material-symbols-outlined text-[16px]">add</span>
          Nuevo grupo
        </Button>
      </div>

      {borrador && (
        <Card>
          <p className="label-caps text-[10px] text-[var(--color-primary-fixed)] mb-4">Nuevo grupo</p>
          <GrupoFormBody value={borrador} sedes={sedes} onChange={setBorrador} />
          <div className="flex gap-3 mt-5">
            <Button size="sm" onClick={() => guardar(borrador)} loading={procesando === (borrador.id ?? 'new')}>
              Crear
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBorrador(null)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {cargando ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <GrupoRow key={g.id} grupo={g} sedes={sedes} onGuardar={guardar} onBorrar={borrar} procesando={procesando === g.id} />
          ))}
          {grupos.length === 0 && !borrador && (
            <Card><p className="text-center text-sm text-white/50 py-8">No hay grupos.</p></Card>
          )}
        </div>
      )}
    </div>
  )
}

function GrupoRow({ grupo, sedes, onGuardar, onBorrar, procesando }: {
  grupo: Grupo
  sedes: Sede[]
  onGuardar: (g: Partial<Grupo>) => Promise<void>
  onBorrar: (g: Grupo) => Promise<void>
  procesando: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [draft, setDraft] = useState<Grupo>(grupo)

  if (!editando) {
    return (
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="font-display text-lg font-black text-white">{grupo.nombre}</p>
              <Badge variant="primary">{grupo.sedeCodigo}</Badge>
              {!grupo.disponible && <Badge variant="danger">No disponible</Badge>}
            </div>
            <p className="text-xs text-white/60 mt-1">
              {grupo.nivel} · Cupo {grupo.cupoMaximo}{grupo.coach ? ` · ${grupo.coach}` : ''}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {grupo.horarios.map((h) => (
                <span key={h} className="label-caps text-[9px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                  {h}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setDraft(grupo); setEditando(true) }}>Editar</Button>
            <Button size="sm" variant="danger" onClick={() => onBorrar(grupo)} loading={procesando}>Eliminar</Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <GrupoFormBody value={draft} sedes={sedes} onChange={(d) => setDraft(d as Grupo)} />
      <div className="flex gap-3 mt-5">
        <Button
          size="sm"
          loading={procesando}
          onClick={async () => {
            // Forzar el id original del grupo — protege contra derivar
            // un id nuevo desde el nombre editado y crear un doc duplicado.
            await onGuardar({ ...draft, id: grupo.id })
            setEditando(false)
          }}
        >
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>
      </div>
    </Card>
  )
}

function GrupoFormBody({ value, sedes, onChange }: {
  value: Partial<Grupo>; sedes: Sede[]; onChange: (v: Partial<Grupo>) => void
}) {
  const horarios = value.horarios ?? ['']
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Nombre del grupo *">
        <InputText
          value={value.nombre ?? ''}
          onChange={(e) => onChange({ ...value, nombre: e.target.value })}
          placeholder="Estrellas UTP"
        />
      </Field>
      <Field label="Sede *">
        <select
          value={value.sedeCodigo ?? ''}
          onChange={(e) => onChange({ ...value, sedeCodigo: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
        >
          <option value="" className="bg-[#0a0a0a]">Selecciona sede…</option>
          {sedes.map((s) => (
            <option key={s.id} value={s.codigo} className="bg-[#0a0a0a]">
              {s.nombre} ({s.codigo})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nivel">
        <InputText
          value={value.nivel ?? ''}
          onChange={(e) => onChange({ ...value, nivel: e.target.value })}
          placeholder="Principiantes / Intermedio / Todos"
        />
      </Field>
      <Field label="Coach">
        <InputText
          value={value.coach ?? ''}
          onChange={(e) => onChange({ ...value, coach: e.target.value })}
          placeholder="Coach Ana Torres"
        />
      </Field>
      <Field label="Cupo máximo">
        <InputText
          type="number"
          value={String(value.cupoMaximo ?? 12)}
          onChange={(e) => onChange({ ...value, cupoMaximo: Number(e.target.value) || 12 })}
        />
      </Field>
      <label className="flex items-center gap-3 text-sm text-white">
        <input
          type="checkbox"
          checked={value.disponible !== false}
          onChange={(e) => onChange({ ...value, disponible: e.target.checked })}
        />
        Disponible para inscripción
      </label>
      <div className="md:col-span-2">
        <Field label="Horarios" hint="Ej: 'Lun · 6:00 PM'">
          <div className="space-y-2">
            {horarios.map((h, i) => (
              <div key={i} className="flex gap-2">
                <InputText
                  value={h}
                  onChange={(e) => {
                    const nuevos = [...horarios]; nuevos[i] = e.target.value
                    onChange({ ...value, horarios: nuevos })
                  }}
                  placeholder="Lun · 6:00 PM"
                />
                <Button size="sm" variant="ghost" onClick={() => {
                  onChange({ ...value, horarios: horarios.filter((_, j) => j !== i) })
                }}>×</Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...value, horarios: [...horarios, ''] })}>
              + Agregar horario
            </Button>
          </div>
        </Field>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB TARIFAS
// ─────────────────────────────────────────────────────────────

function TarifasTab({ actualizadoPor }: { actualizadoPor?: string }) {
  const [tarifas, setTarifas] = useState<Tarifas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [errorPersistente, setErrorPersistente] = useState<string | null>(null)

  useEffect(() => {
    getTarifas()
      .then((t) => setTarifas(t))
      .catch((e) => setErrorPersistente(`Lectura falló: ${errStr(e)}`))
      .finally(() => setCargando(false))
  }, [])

  function update(fn: (t: Tarifas) => Tarifas) {
    if (!tarifas) return
    setTarifas(fn(tarifas))
    setDirty(true)
    setGuardado(false)
  }

  async function guardarTodo() {
    if (!tarifas) return
    setErrorPersistente(null)
    setGuardando(true)
    try {
      console.log('[TARIFAS_SAVE] escribiendo v' + ((tarifas.version ?? 0) + 1))
      await actualizarTarifas({
        version: (tarifas.version ?? 0) + 1,
        grupoPorSesion: tarifas.grupoPorSesion,
        personales: tarifas.personales,
        conjuntos: tarifas.conjuntos,
        vacacionesPorNino: tarifas.vacacionesPorNino,
      }, actualizadoPor)
      console.log('[TARIFAS_SAVE] OK')
      setDirty(false)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (e: any) {
      console.error('[TARIFAS_SAVE] falló', e)
      setErrorPersistente(`Guardar falló: ${errStr(e)}`)
    } finally { setGuardando(false) }
  }

  if (cargando) return <div className="flex justify-center py-10"><Spinner /></div>
  if (!tarifas) return (
    <Card>
      <p className="text-center text-sm text-white/60 py-6">
        No hay tarifas cargadas. Ve a /admin y presiona "Sembrar catálogo".
      </p>
    </Card>
  )

  const fmtActualizado = tarifas.actualizadoEn
    ? new Date(tarifas.actualizadoEn).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  return (
    <div className="space-y-6">
      <BannerError error={errorPersistente} onDismiss={() => setErrorPersistente(null)} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-white/60">Matriz de precios que consume el wizard del alumno.</p>
          <p className="text-[10px] text-white/40 mt-1">
            Versión {tarifas.version} · Actualizado: {fmtActualizado}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {guardado && <span className="text-xs text-[var(--color-success-emerald)]">Guardado ✓</span>}
          {dirty && !guardando && <span className="text-xs text-yellow-400">Cambios sin guardar</span>}
          <Button size="sm" onClick={guardarTodo} loading={guardando} disabled={!dirty}>
            <span className="material-symbols-outlined text-[16px]">save</span>
            Guardar cambios
          </Button>
        </div>
      </div>

      {/* Grupal */}
      <Card>
        <p className="label-caps text-[10px] text-[var(--color-primary-fixed)] mb-1">GRUPAL</p>
        <p className="text-sm text-white/60 mb-5">Precio POR SESIÓN según frecuencia semanal.</p>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((week) => (
            <Field key={week} label={`${week}x / semana`}>
              <InputPrecio
                value={tarifas.grupoPorSesion[week] ?? null}
                onChange={(v) => update((t) => ({ ...t, grupoPorSesion: { ...t.grupoPorSesion, [week]: v ?? 0 } }))}
              />
            </Field>
          ))}
        </div>
      </Card>

      {/* Personales */}
      <Card>
        <p className="label-caps text-[10px] text-[var(--color-primary-fixed)] mb-1">PERSONALES</p>
        <p className="text-sm text-white/60 mb-5">Precio mensual según sesiones/mes (4=1x, 8=2x, 12=3x).</p>
        <div className="space-y-6">
          {Object.entries(tarifas.personales).map(([id, p]) => (
            <div key={id} className="border-t border-white/5 pt-5 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-display text-sm font-black text-white uppercase">{id}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Categoría {p.categoria} · {p.porPersona ? `por persona (${p.personasMin}–${p.personasMax})` : 'monto único'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[4, 8, 12].map((mes) => (
                  <Field key={mes} label={`x${mes} sesiones`}>
                    <InputPrecio
                      value={p.precios[mes] ?? null}
                      onChange={(v) => update((t) => ({
                        ...t,
                        personales: {
                          ...t.personales,
                          [id]: { ...p, precios: { ...p.precios, [mes]: v } },
                        },
                      }))}
                    />
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Conjuntos */}
      <Card>
        <p className="label-caps text-[10px] text-[var(--color-primary-fixed)] mb-1">CONJUNTOS</p>
        <p className="text-sm text-white/60 mb-5">Precio mensual según frecuencia semanal (1 o 2).</p>
        <div className="space-y-6">
          {Object.entries(tarifas.conjuntos).map(([id, c]) => (
            <div key={id} className="border-t border-white/5 pt-5 first:border-t-0 first:pt-0">
              <p className="font-display text-sm font-black text-white uppercase mb-3">{id}</p>
              <div className="grid grid-cols-2 gap-4">
                {[1, 2].map((week) => (
                  <Field key={week} label={`${week}x / semana`}>
                    <InputPrecio
                      value={c.precios[week] ?? null}
                      onChange={(v) => update((t) => ({
                        ...t,
                        conjuntos: {
                          ...t.conjuntos,
                          [id]: { precios: { ...c.precios, [week]: v } },
                        },
                      }))}
                    />
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Vacaciones */}
      <Card>
        <p className="label-caps text-[10px] text-[var(--color-primary-fixed)] mb-1">VACACIONES DEPORTIVAS</p>
        <p className="text-sm text-white/60 mb-5">Programa intensivo de 2 semanas — precio por niño.</p>
        <div className="max-w-xs">
          <Field label="Por niño">
            <InputPrecio
              value={tarifas.vacacionesPorNino}
              onChange={(v) => update((t) => ({ ...t, vacacionesPorNino: v ?? 0 }))}
            />
          </Field>
        </div>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB PLANTILLAS (planes/ legacy)
// ─────────────────────────────────────────────────────────────

const PLAN_VACIO: Omit<Plan, 'id' | 'planId' | 'creadoEn'> = {
  nombre: '',
  descripcion: '',
  catalogo_codigo: '',
  sesiones_incluidas: 8,
  duracion_dias: 30,
  precio_total: 0,
  sede: '',
  estado: true,
}

function PlantillasTab() {
  const [planes, setPlanes] = useState<Plan[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState<typeof PLAN_VACIO | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Plan>>({})
  const [procesando, setProcesando] = useState<string | null>(null)

  useEffect(() => {
    getPlanes(false).then(setPlanes).catch(console.error).finally(() => setCargando(false))
  }, [])

  async function crear() {
    if (!nuevo) return
    setProcesando('nuevo')
    try {
      const id = await crearPlan(nuevo)
      setPlanes((prev) => [{ ...nuevo, id, planId: id, creadoEn: Date.now() } as Plan, ...prev])
      setNuevo(null)
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo crear el plan.')
    } finally { setProcesando(null) }
  }

  async function actualizar(id: string) {
    setProcesando(id)
    try {
      await actualizarPlan(id, draft)
      setPlanes((prev) => prev.map((p) => p.id === id ? { ...p, ...draft } : p))
      setEditando(null); setDraft({})
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo actualizar.')
    } finally { setProcesando(null) }
  }

  async function archivar(p: Plan) {
    if (!window.confirm(`¿Archivar "${p.nombre}"?`)) return
    setProcesando(p.id)
    try {
      await archivarPlan(p.id)
      setPlanes((prev) => prev.map((x) => x.id === p.id ? { ...x, estado: false } : x))
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo archivar.')
    } finally { setProcesando(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-white/60 max-w-xl">
          Plantillas nombradas para casos especiales (promos, descuentos, planes corporativos).
          <strong className="text-white/80"> El wizard NO las usa</strong> — se piensan como
          overrides manuales. Puedes ignorarlas si no las necesitas.
        </p>
        <Button size="sm" onClick={() => setNuevo(PLAN_VACIO)}>
          <span className="material-symbols-outlined text-[16px]">add</span>
          Nueva plantilla
        </Button>
      </div>

      {nuevo && (
        <Card>
          <p className="label-caps text-[10px] text-[var(--color-primary-fixed)] mb-4">Nueva plantilla</p>
          <PlanFormBody value={nuevo} onChange={(v) => setNuevo(v as typeof PLAN_VACIO)} />
          <div className="flex gap-3 mt-5">
            <Button size="sm" onClick={crear} loading={procesando === 'nuevo'}>Crear</Button>
            <Button size="sm" variant="ghost" onClick={() => setNuevo(null)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {cargando ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          {planes.map((p) => (
            <Card key={p.id}>
              {editando === p.id ? (
                <div>
                  <PlanFormBody value={draft} onChange={setDraft} />
                  <div className="flex gap-3 mt-5">
                    <Button size="sm" onClick={() => actualizar(p.id)} loading={procesando === p.id}>Guardar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditando(null); setDraft({}) }}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-display text-lg font-black text-white">{p.nombre}</p>
                      <Badge variant={p.estado ? 'success' : 'default'}>{p.estado ? 'Activo' : 'Archivado'}</Badge>
                      {p.sede_aplica && <Badge variant="primary">{p.sede_aplica}</Badge>}
                      {p.sede && !p.sede_aplica && <Badge variant="primary">{p.sede}</Badge>}
                    </div>
                    <p className="text-sm text-white/70 mt-1">
                      {p.sesiones_incluidas} sesiones · {fmtCOP(p.precio_total)}
                      {p.duracion_dias ? ` · ${p.duracion_dias}d` : ''}
                    </p>
                    {p.descripcion && <p className="text-xs text-white/50 mt-1">{p.descripcion}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setDraft(p); setEditando(p.id) }}>Editar</Button>
                    {p.estado && (
                      <Button size="sm" variant="danger" onClick={() => archivar(p)} loading={procesando === p.id}>Archivar</Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
          {planes.length === 0 && !nuevo && (
            <Card>
              <p className="text-center text-sm text-white/50 py-8">No hay plantillas.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function PlanFormBody({ value, onChange }: { value: Partial<Plan>; onChange: (v: Partial<Plan>) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Nombre *">
        <InputText
          value={value.nombre ?? ''}
          onChange={(e) => onChange({ ...value, nombre: e.target.value })}
          placeholder="Plan Black Friday 3x/sem"
        />
      </Field>
      <Field label="Sede">
        <InputText
          value={value.sede_aplica ?? value.sede ?? ''}
          onChange={(e) => onChange({ ...value, sede_aplica: e.target.value })}
          placeholder="UTP"
        />
      </Field>
      <Field label="Sesiones incluidas *">
        <InputText
          type="number"
          value={String(value.sesiones_incluidas ?? 8)}
          onChange={(e) => onChange({ ...value, sesiones_incluidas: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="Precio total (COP) *" hint={value.precio_total ? fmtCOP(value.precio_total) : '—'}>
        <InputText
          type="number"
          value={String(value.precio_total ?? 0)}
          onChange={(e) => onChange({ ...value, precio_total: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="Duración (días)">
        <InputText
          type="number"
          value={String(value.duracion_dias ?? 30)}
          onChange={(e) => onChange({ ...value, duracion_dias: Number(e.target.value) || 30 })}
        />
      </Field>
      <Field label="Estado">
        <select
          value={value.estado === false ? 'false' : 'true'}
          onChange={(e) => onChange({ ...value, estado: e.target.value === 'true' })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
        >
          <option value="true" className="bg-[#0a0a0a]">Activo</option>
          <option value="false" className="bg-[#0a0a0a]">Archivado</option>
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Descripción (opcional)">
          <InputText
            value={value.descripcion ?? ''}
            onChange={(e) => onChange({ ...value, descripcion: e.target.value })}
            placeholder="Detalle o notas del plan"
          />
        </Field>
      </div>
    </div>
  )
}
