'use client'

// ============================================================
// FAROS — Admin · Gestión de planes
// El admin edita AQUÍ el catálogo que alimenta el flujo
// "Arma tu plan" del alumno (lib/planes.ts): grupos y sus
// horarios, tarifas por frecuencia, modalidades personalizadas,
// conjuntos y vacaciones.
// Los cambios viven en estado local hasta conectar Firestore.
// ============================================================

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button, Input, Spinner } from '@/components/ui'
import {
  GRUPOS, GRUPO_POR_SESION, PERSONALES, CONJUNTOS, VACACIONES_POR_NINO,
  fmtCOP, type Grupo, type SubPersonal, type Conjunto,
} from '@/lib/planes'
import { getPlanes, crearPlan, actualizarPlan, archivarPlan } from '@/lib/firestore'
import type { Plan } from '@/lib/types'

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

type Cat = 'grupos' | 'personales' | 'conjuntos' | 'vacaciones' | 'firestore'

const CATS: { id: Cat; label: string; icon: string }[] = [
  { id: 'grupos', label: 'Grupos', icon: 'groups' },
  { id: 'personales', label: 'Personalizados', icon: 'person' },
  { id: 'conjuntos', label: 'Conjuntos', icon: 'join_inner' },
  { id: 'vacaciones', label: 'Vacaciones', icon: 'child_care' },
  { id: 'firestore', label: 'Planes activos', icon: 'database' },
]

// Plan vacío para crear nuevos
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

// Campo numérico en pesos
function CampoPrecio({ label, value, onChange }: {
  label: string; value: number | null; onChange: (v: number | null) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="label-caps text-[10px] text-[var(--color-on-surface-variant)]">{label}</label>
      <input
        type="number"
        min={0}
        step={1000}
        value={value ?? ''}
        placeholder="Por confirmar"
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-3.5 text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/30 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors duration-300"
      />
      <span className="text-[10px] text-[var(--color-on-surface-variant)]/50">
        {value != null ? fmtCOP(value) : 'Sin tarifa definida'}
      </span>
    </div>
  )
}

// Cabecera de ítem con acciones
function ItemHeader({ titulo, chips, editando, onToggle, extra }: {
  titulo: string; chips?: React.ReactNode; editando: boolean; onToggle: () => void; extra?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-tight">{titulo}</h3>
        {chips && <div className="flex flex-wrap gap-2 mt-3">{chips}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {extra}
        <Button size="sm" variant={editando ? 'primary' : 'ghost'} onClick={onToggle}>
          {editando ? 'Listo' : 'Editar'}
        </Button>
      </div>
    </div>
  )
}

const chip = (t: string) => (
  <span key={t} className="label-caps text-[9px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[var(--color-on-surface-variant)]/70">
    {t}
  </span>
)

export default function AdminPlanesPage() {
  const { authorized, loading } = useRoleGuard(['admin'])
  const [cat, setCat] = useState<Cat>('grupos')
  const [editId, setEditId] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  // Catálogo editable local
  const [grupos, setGrupos] = useState<Grupo[]>(() => GRUPOS.map((g) => ({ ...g, horarios: [...g.horarios] })))
  const [tarifas, setTarifas] = useState<Record<number, number>>({ ...GRUPO_POR_SESION })
  const [personales, setPersonales] = useState<SubPersonal[]>(() => PERSONALES.map((p) => ({ ...p, precios: { ...p.precios } })))
  const [conjuntos, setConjuntos] = useState<Conjunto[]>(() => CONJUNTOS.map((c) => ({ ...c, precios: { ...c.precios } })))
  const [vacaciones, setVacaciones] = useState<number>(VACACIONES_POR_NINO)

  // Planes Firestore
  const [planes, setPlanes] = useState<Plan[]>([])
  const [cargandoPlanes, setCargandoPlanes] = useState(false)
  const [nuevoForm, setNuevoForm] = useState<Omit<Plan, 'id' | 'planId' | 'creadoEn'> | null>(null)
  const [guardandoPlan, setGuardandoPlan] = useState<string | null>(null)
  const [planEditId, setPlanEditId] = useState<string | null>(null)
  const [planEditData, setPlanEditData] = useState<Partial<Plan>>({})

  useEffect(() => {
    if (cat !== 'firestore') return
    setCargandoPlanes(true)
    getPlanes(false)
      .then(setPlanes)
      .catch(console.error)
      .finally(() => setCargandoPlanes(false))
  }, [cat])

  async function guardarNuevoPlan() {
    if (!nuevoForm) return
    setGuardandoPlan('nuevo')
    try {
      const id = await crearPlan(nuevoForm)
      const nuevo: Plan = { ...nuevoForm, id, planId: id, creadoEn: Date.now() }
      setPlanes((prev) => [nuevo, ...prev])
      setNuevoForm(null)
    } catch (e: any) {
      console.error(e)
      alert(e?.message ?? 'No se pudo crear el plan.')
    } finally { setGuardandoPlan(null) }
  }

  async function guardarEdicionPlan(planId: string) {
    setGuardandoPlan(planId)
    try {
      await actualizarPlan(planId, planEditData)
      setPlanes((prev) => prev.map((p) => p.id === planId ? { ...p, ...planEditData } : p))
      setPlanEditId(null)
      setPlanEditData({})
    } catch (e: any) {
      console.error(e)
      alert(e?.message ?? 'No se pudo actualizar el plan.')
    } finally { setGuardandoPlan(null) }
  }

  async function archivar(planId: string) {
    const plan = planes.find((p) => p.id === planId)
    if (!window.confirm(`¿Archivar el plan "${plan?.nombre ?? planId}"?\n\nDejará de aparecer para los alumnos, pero las suscripciones activas siguen vigentes.`)) return
    setGuardandoPlan(planId)
    try {
      await archivarPlan(planId)
      setPlanes((prev) => prev.map((p) => p.id === planId ? { ...p, estado: false } : p))
    } catch (e: any) {
      console.error(e)
      alert(e?.message ?? 'No se pudo archivar el plan.')
    } finally { setGuardandoPlan(null) }
  }

  function marcarGuardado() {
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  const toggleEdit = (id: string) => {
    setEditId((cur) => {
      if (cur === id) { marcarGuardado(); return null }
      return id
    })
  }

  // ── Altas ──
  function nuevoGrupo() {
    const id = `grupo-${Date.now()}`
    setGrupos((g) => [...g, {
      id, nombre: 'Nuevo grupo', horarios: ['Lun · 6:00 PM'], disponible: false,
      nivel: 'Por definir', cupos: 'Cupos por definir', coach: 'Por asignar',
    }])
    setEditId(id)
  }
  function nuevaPersonal() {
    const id = `personal-${Date.now()}`
    setPersonales((p) => [...p, {
      id, nombre: 'Nueva modalidad', desc: 'Describe la modalidad.',
      porPersona: false, personasMin: 1, personasMax: 1,
      precios: { 4: 0, 8: 0, 12: 0 }, incluye: ['Beneficio 1'],
    }])
    setEditId(id)
  }
  function nuevoConjunto() {
    const id = `conjunto-${Date.now()}`
    setConjuntos((c) => [...c, {
      id, nombre: 'Nuevo conjunto', desc: 'Describe la combinación.',
      precios: { 1: null, 2: null }, incluye: ['Disciplina 1'],
    }])
    setEditId(id)
  }

  // ── Bajas ──
  const eliminar = (tipo: Cat, id: string) => {
    if (tipo === 'grupos') setGrupos((g) => g.filter((x) => x.id !== id))
    if (tipo === 'personales') setPersonales((p) => p.filter((x) => x.id !== id))
    if (tipo === 'conjuntos') setConjuntos((c) => c.filter((x) => x.id !== id))
    setEditId(null)
  }

  const BotonEliminar = ({ tipo, id, nombre }: { tipo: Cat; id: string; nombre: string }) => (
    <button
      onClick={() => eliminar(tipo, id)}
      aria-label={`Eliminar ${nombre}`}
      className="w-9 h-9 flex items-center justify-center text-[var(--color-on-surface-variant)]/50 hover:text-[var(--color-danger-crimson)] hover:bg-[rgba(239,68,68,0.1)] rounded-xl transition-colors duration-200 active:scale-[0.94]"
    >
      <span className="material-symbols-outlined text-[20px]">delete</span>
    </button>
  )

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Planes">
      <div className="space-y-8">

        {/* ── Header ── */}
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Catálogo del club</p>
              <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
                Planes
              </h2>
              <p className="text-sm text-[var(--color-on-surface-variant)]/70 mt-4 max-w-xl leading-relaxed">
                Lo que definas aquí es lo que el atleta ve al armar su plan.
                Las tarifas alimentan el cálculo automático del precio.
              </p>
            </div>
            {guardado && (
              <motion.span
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="label-caps text-[10px] px-4 py-2.5 rounded-full bg-[rgba(16,185,129,0.15)] text-[var(--color-success-emerald)] flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Cambios guardados
              </motion.span>
            )}
          </div>
        </Reveal>

        {/* ── Categorías ── */}
        <Reveal delay={0.06}>
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCat(c.id); setEditId(null) }}
                aria-pressed={cat === c.id}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl border label-caps text-[10px] transition-[background-color,border-color,color] duration-200 ${
                  cat === c.id
                    ? 'bg-[var(--color-primary-fixed)] text-black border-transparent'
                    : 'bg-white/[0.03] text-[var(--color-on-surface-variant)] border-white/8 hover:text-white hover:border-white/20'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </Reveal>

        {/* ══ GRUPOS ══ */}
        {cat === 'grupos' && (
          <div className="space-y-6">
            {/* Tarifas por frecuencia */}
            <Reveal delay={0.1}>
              <Card padding="lg">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">payments</span>
                  <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                    Tarifa por sesión
                  </h3>
                </div>
                <p className="text-sm text-[var(--color-on-surface-variant)]/60 mb-7">
                  A mayor frecuencia, menor precio por sesión. El total mensual se calcula
                  multiplicando por las sesiones del mes.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {[1, 2, 3].map((w) => (
                    <div key={w}>
                      <CampoPrecio
                        label={`${w}× / semana`}
                        value={tarifas[w]}
                        onChange={(v) => { setTarifas((t) => ({ ...t, [w]: v ?? 0 })); }}
                      />
                      <p className="label-caps text-[9px] text-[var(--color-primary-fixed)]/80 mt-2">
                        Mes: {fmtCOP((tarifas[w] ?? 0) * w * 4)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-7">
                  <Button size="sm" onClick={marcarGuardado}>Guardar tarifas</Button>
                </div>
              </Card>
            </Reveal>

            {grupos.map((g, i) => {
              const editando = editId === g.id
              return (
                <Reveal key={g.id} delay={0.12 + i * 0.04}>
                  <Card padding="lg">
                    <ItemHeader
                      titulo={g.nombre}
                      editando={editando}
                      onToggle={() => toggleEdit(g.id)}
                      extra={<BotonEliminar tipo="grupos" id={g.id} nombre={g.nombre} />}
                      chips={
                        <>
                          {g.horarios.map(chip)}
                          <Badge variant={g.disponible ? 'success' : 'danger'}>
                            {g.disponible ? 'Con cupos' : 'Sin cupos'}
                          </Badge>
                        </>
                      }
                    />

                    {editando && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="mt-7 pt-7 border-t border-white/8 space-y-5"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <Input
                            label="Nombre del grupo"
                            value={g.nombre}
                            onChange={(e) => setGrupos((prev) => prev.map((x) => x.id === g.id ? { ...x, nombre: e.target.value } : x))}
                          />
                          <Input
                            label="Entrenador asignado"
                            value={g.coach}
                            onChange={(e) => setGrupos((prev) => prev.map((x) => x.id === g.id ? { ...x, coach: e.target.value } : x))}
                          />
                          <Input
                            label="Nivel"
                            value={g.nivel}
                            onChange={(e) => setGrupos((prev) => prev.map((x) => x.id === g.id ? { ...x, nivel: e.target.value } : x))}
                          />
                          <Input
                            label="Cupos"
                            value={g.cupos}
                            onChange={(e) => setGrupos((prev) => prev.map((x) => x.id === g.id ? { ...x, cupos: e.target.value } : x))}
                          />
                        </div>

                        <Input
                          label="Horarios (separados por coma)"
                          value={g.horarios.join(', ')}
                          onChange={(e) => setGrupos((prev) => prev.map((x) => x.id === g.id
                            ? { ...x, horarios: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }
                            : x))}
                        />

                        <label className="flex items-center justify-between p-5 rounded-2xl border border-white/8 bg-white/[0.03] cursor-pointer">
                          <span>
                            <span className="block text-sm font-bold text-white">Disponible para inscripción</span>
                            <span className="block text-[11px] text-[var(--color-on-surface-variant)]/60 mt-1">
                              Si lo apagas, el atleta lo verá como “cupos por confirmar”.
                            </span>
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={g.disponible}
                            aria-label={`Disponibilidad de ${g.nombre}`}
                            onClick={() => setGrupos((prev) => prev.map((x) => x.id === g.id ? { ...x, disponible: !x.disponible } : x))}
                            className={`relative w-12 h-6 rounded-full shrink-0 transition-colors duration-300 ${
                              g.disponible ? 'bg-[var(--color-primary-fixed)]' : 'bg-white/10'
                            }`}
                          >
                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 ${
                              g.disponible ? 'translate-x-6 bg-black' : 'translate-x-0 bg-white/40'
                            }`} />
                          </button>
                        </label>
                      </motion.div>
                    )}
                  </Card>
                </Reveal>
              )
            })}

            <Button variant="outline" fullWidth onClick={nuevoGrupo}>
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Añadir grupo
            </Button>
          </div>
        )}

        {/* ══ PERSONALIZADOS ══ */}
        {cat === 'personales' && (
          <div className="space-y-6">
            {personales.map((p, i) => {
              const editando = editId === p.id
              return (
                <Reveal key={p.id} delay={0.08 + i * 0.04}>
                  <Card padding="lg">
                    <ItemHeader
                      titulo={p.nombre}
                      editando={editando}
                      onToggle={() => toggleEdit(p.id)}
                      extra={<BotonEliminar tipo="personales" id={p.id} nombre={p.nombre} />}
                      chips={
                        <>
                          {chip(`4 ses. ${fmtCOP(p.precios[4] ?? 0)}`)}
                          {chip(`8 ses. ${fmtCOP(p.precios[8] ?? 0)}`)}
                          {chip(`12 ses. ${fmtCOP(p.precios[12] ?? 0)}`)}
                          {p.porPersona && <Badge variant="primary">Por persona</Badge>}
                        </>
                      }
                    />

                    {editando && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="mt-7 pt-7 border-t border-white/8 space-y-5"
                      >
                        <Input
                          label="Nombre"
                          value={p.nombre}
                          onChange={(e) => setPersonales((prev) => prev.map((x) => x.id === p.id ? { ...x, nombre: e.target.value } : x))}
                        />
                        <Input
                          label="Descripción"
                          value={p.desc}
                          onChange={(e) => setPersonales((prev) => prev.map((x) => x.id === p.id ? { ...x, desc: e.target.value } : x))}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                          {[4, 8, 12].map((mes) => (
                            <CampoPrecio
                              key={mes}
                              label={`${mes} sesiones / mes`}
                              value={p.precios[mes] ?? 0}
                              onChange={(v) => setPersonales((prev) => prev.map((x) => x.id === p.id
                                ? { ...x, precios: { ...x.precios, [mes]: v ?? 0 } } : x))}
                            />
                          ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-end">
                          <Input
                            label="Mínimo de personas"
                            type="number" min={1}
                            value={p.personasMin}
                            onChange={(e) => setPersonales((prev) => prev.map((x) => x.id === p.id ? { ...x, personasMin: Number(e.target.value) } : x))}
                          />
                          <Input
                            label="Máximo de personas"
                            type="number" min={1}
                            value={p.personasMax}
                            onChange={(e) => setPersonales((prev) => prev.map((x) => x.id === p.id ? { ...x, personasMax: Number(e.target.value) } : x))}
                          />
                          <label className="flex items-center justify-between p-4 rounded-2xl border border-white/8 bg-white/[0.03] cursor-pointer">
                            <span className="text-sm text-white">Precio por persona</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={p.porPersona}
                              aria-label={`Cobro por persona en ${p.nombre}`}
                              onClick={() => setPersonales((prev) => prev.map((x) => x.id === p.id ? { ...x, porPersona: !x.porPersona } : x))}
                              className={`relative w-12 h-6 rounded-full shrink-0 transition-colors duration-300 ${
                                p.porPersona ? 'bg-[var(--color-primary-fixed)]' : 'bg-white/10'
                              }`}
                            >
                              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 ${
                                p.porPersona ? 'translate-x-6 bg-black' : 'translate-x-0 bg-white/40'
                              }`} />
                            </button>
                          </label>
                        </div>
                      </motion.div>
                    )}
                  </Card>
                </Reveal>
              )
            })}

            <Button variant="outline" fullWidth onClick={nuevaPersonal}>
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Añadir modalidad
            </Button>
          </div>
        )}

        {/* ══ CONJUNTOS ══ */}
        {cat === 'conjuntos' && (
          <div className="space-y-6">
            {conjuntos.map((c, i) => {
              const editando = editId === c.id
              return (
                <Reveal key={c.id} delay={0.08 + i * 0.04}>
                  <Card padding="lg">
                    <ItemHeader
                      titulo={c.nombre}
                      editando={editando}
                      onToggle={() => toggleEdit(c.id)}
                      extra={<BotonEliminar tipo="conjuntos" id={c.id} nombre={c.nombre} />}
                      chips={
                        <>
                          {chip(`1× ${c.precios[1] != null ? fmtCOP(c.precios[1]!) : 'por confirmar'}`)}
                          {chip(`2× ${c.precios[2] != null ? fmtCOP(c.precios[2]!) : 'por confirmar'}`)}
                        </>
                      }
                    />

                    {editando && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="mt-7 pt-7 border-t border-white/8 space-y-5"
                      >
                        <Input
                          label="Nombre"
                          value={c.nombre}
                          onChange={(e) => setConjuntos((prev) => prev.map((x) => x.id === c.id ? { ...x, nombre: e.target.value } : x))}
                        />
                        <Input
                          label="Descripción"
                          value={c.desc}
                          onChange={(e) => setConjuntos((prev) => prev.map((x) => x.id === c.id ? { ...x, desc: e.target.value } : x))}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          {[1, 2].map((w) => (
                            <CampoPrecio
                              key={w}
                              label={`${w}× / semana (mensual)`}
                              value={c.precios[w] ?? null}
                              onChange={(v) => setConjuntos((prev) => prev.map((x) => x.id === c.id
                                ? { ...x, precios: { ...x.precios, [w]: v } } : x))}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] text-[var(--color-on-surface-variant)]/50">
                          Deja el campo vacío para que el atleta vea “tarifa por confirmar”.
                        </p>
                      </motion.div>
                    )}
                  </Card>
                </Reveal>
              )
            })}

            <Button variant="outline" fullWidth onClick={nuevoConjunto}>
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Añadir conjunto
            </Button>
          </div>
        )}

        {/* ══ VACACIONES ══ */}
        {cat === 'vacaciones' && (
          <Reveal delay={0.08}>
            <Card padding="lg">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">child_care</span>
                <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
                  Vacaciones deportivas
                </h3>
              </div>
              <p className="text-sm text-[var(--color-on-surface-variant)]/60 mb-7">
                Programa intensivo de 2 semanas. El total se multiplica por el número
                de niños inscritos.
              </p>
              <div className="max-w-xs">
                <CampoPrecio
                  label="Precio por niño"
                  value={vacaciones}
                  onChange={(v) => setVacaciones(v ?? 0)}
                />
              </div>
              <div className="flex items-center justify-between mt-7 pt-7 border-t border-white/8">
                <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50">
                  Ejemplo · 3 niños
                </span>
                <span className="font-display font-black text-[var(--color-primary-fixed)]">
                  {fmtCOP(vacaciones * 3)}
                </span>
              </div>
              <div className="flex justify-end mt-7">
                <Button size="sm" onClick={marcarGuardado}>Guardar</Button>
              </div>
            </Card>
          </Reveal>
        )}

        {/* ══ PLANES FIRESTORE ══ */}
        {cat === 'firestore' && (
          <div className="space-y-5">
            <Reveal delay={0.08}>
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--color-on-surface-variant)]/60">
                  Estos planes aparecen en el selector de aprobación de finanzas.
                </p>
                <Button size="sm" onClick={() => setNuevoForm({ ...PLAN_VACIO })}>
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  Nuevo plan
                </Button>
              </div>
            </Reveal>

            {/* Formulario nuevo plan */}
            {nuevoForm && (
              <Reveal>
                <Card padding="lg">
                  <h3 className="font-display text-base font-extrabold text-[var(--color-primary-fixed)] uppercase tracking-tight mb-5">
                    Nuevo plan
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Nombre *" value={nuevoForm.nombre}
                      onChange={(e) => setNuevoForm((f) => f && ({ ...f, nombre: e.target.value }))} />
                    <Input label="Sede" value={nuevoForm.sede}
                      onChange={(e) => setNuevoForm((f) => f && ({ ...f, sede: e.target.value }))} />
                    <Input label="Sesiones incluidas" type="number" min={1} value={nuevoForm.sesiones_incluidas}
                      onChange={(e) => setNuevoForm((f) => f && ({ ...f, sesiones_incluidas: Number(e.target.value) }))} />
                    <Input label="Duración (días)" type="number" min={1} value={nuevoForm.duracion_dias}
                      onChange={(e) => setNuevoForm((f) => f && ({ ...f, duracion_dias: Number(e.target.value) }))} />
                    <div className="sm:col-span-2">
                      <CampoPrecio label="Precio total (COP) *" value={nuevoForm.precio_total}
                        onChange={(v) => setNuevoForm((f) => f && ({ ...f, precio_total: v ?? 0 }))} />
                    </div>
                    <div className="sm:col-span-2">
                      <Input label="Descripción" value={nuevoForm.descripcion}
                        onChange={(e) => setNuevoForm((f) => f && ({ ...f, descripcion: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <Button size="sm" loading={guardandoPlan === 'nuevo'}
                      disabled={!nuevoForm.nombre || nuevoForm.precio_total <= 0}
                      onClick={guardarNuevoPlan}>
                      Crear plan
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setNuevoForm(null)}>
                      Cancelar
                    </Button>
                  </div>
                </Card>
              </Reveal>
            )}

            {cargandoPlanes ? (
              <div className="flex justify-center py-12"><Spinner size="md" /></div>
            ) : planes.length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--color-on-surface-variant)]/60 text-center py-4">
                  No hay planes en Firestore todavía. Crea el primero con el botón de arriba.
                </p>
              </Card>
            ) : (
              <Card padding="none" className="overflow-hidden">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-white/5">
                    <tr>
                      {['Nombre', 'Sesiones', 'Duración', 'Precio', 'Estado', ''].map((h) => (
                        <th key={h} className="px-5 py-4 label-caps text-[9px] text-[var(--color-on-surface-variant)]/50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {planes.map((p) => (
                      <tr key={p.id} className="hover:bg-white/[0.03] transition-colors">
                        {planEditId === p.id ? (
                          <td colSpan={6} className="px-5 py-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                              <Input label="Nombre" value={planEditData.nombre ?? p.nombre}
                                onChange={(e) => setPlanEditData((d) => ({ ...d, nombre: e.target.value }))} />
                              <Input label="Sesiones" type="number" min={1}
                                value={planEditData.sesiones_incluidas ?? p.sesiones_incluidas}
                                onChange={(e) => setPlanEditData((d) => ({ ...d, sesiones_incluidas: Number(e.target.value) }))} />
                              <Input label="Días" type="number" min={1}
                                value={planEditData.duracion_dias ?? p.duracion_dias}
                                onChange={(e) => setPlanEditData((d) => ({ ...d, duracion_dias: Number(e.target.value) }))} />
                              <CampoPrecio label="Precio (COP)"
                                value={planEditData.precio_total ?? p.precio_total}
                                onChange={(v) => setPlanEditData((d) => ({ ...d, precio_total: v ?? 0 }))} />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" loading={guardandoPlan === p.id}
                                onClick={() => guardarEdicionPlan(p.id)}>Guardar</Button>
                              <Button size="sm" variant="ghost"
                                onClick={() => { setPlanEditId(null); setPlanEditData({}) }}>Cancelar</Button>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-5 py-4">
                              <p className="text-sm font-bold text-white">{p.nombre}</p>
                              {p.sede && <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/40 mt-0.5">{p.sede}</p>}
                            </td>
                            <td className="px-5 py-4 text-sm text-[var(--color-on-surface-variant)]/70">{p.sesiones_incluidas}</td>
                            <td className="px-5 py-4 text-sm text-[var(--color-on-surface-variant)]/70">{p.duracion_dias} días</td>
                            <td className="px-5 py-4 font-display font-black text-[var(--color-primary-fixed)] text-sm">
                              {fmtCOP(p.precio_total)}
                            </td>
                            <td className="px-5 py-4">
                              <Badge variant={p.estado ? 'success' : 'danger'}>
                                {p.estado ? 'Activo' : 'Archivado'}
                              </Badge>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => { setPlanEditId(p.id); setPlanEditData({}) }}
                                  className="p-2 rounded-lg text-[var(--color-on-surface-variant)]/40 hover:text-white hover:bg-white/5 transition-colors"
                                  title="Editar">
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                {p.estado && (
                                  <button
                                    onClick={() => archivar(p.id)}
                                    disabled={guardandoPlan === p.id}
                                    className="p-2 rounded-lg text-[var(--color-on-surface-variant)]/40 hover:text-[var(--color-danger-crimson)] hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                                    title="Archivar">
                                    <span className="material-symbols-outlined text-[18px]">archive</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )}

        {cat !== 'firestore' && (
          <p className="text-[11px] text-[var(--color-on-surface-variant)]/40 text-center pt-2">
            Catálogo visual del wizard. Para planes de suscripción usa la pestaña "Planes activos".
          </p>
        )}
      </div>
    </GuardedShell>
  )
}
