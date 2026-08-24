'use client'

// ============================================================
// FAROS — Tarjeta de gestión de una rutina virtual
// CRUD de sesiones (título, descripción, link de video) de UN alumno.
// Reutilizada por /portal/virtual (el profesor dueño) y por la pestaña
// Virtual de /admin/planes (el admin, para cualquier rutina).
// ============================================================

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Card, Button, Spinner } from '@/components/ui'
import {
  getSesionesVirtuales,
  crearSesionVirtual, actualizarSesionVirtual, eliminarSesionVirtual,
} from '@/lib/firestore'
import { embedUrlFromVideoUrl } from '@/lib/video'
import type { RutinaVirtual, SesionVirtual } from '@/lib/types'

const EASE = [0.22, 1, 0.36, 1] as const
const CAMPO_VACIO = { titulo: '', descripcion: '', videoUrl: '' }

export function RutinaVirtualCard({ rutina, subtitulo }: { rutina: RutinaVirtual; subtitulo?: string }) {
  const [abierta, setAbierta] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [sesiones, setSesiones] = useState<SesionVirtual[] | null>(null)
  const [nuevo, setNuevo] = useState<typeof CAMPO_VACIO | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [draft, setDraft] = useState<typeof CAMPO_VACIO>(CAMPO_VACIO)

  async function abrir() {
    const next = !abierta
    setAbierta(next)
    if (next && sesiones === null) {
      setCargando(true)
      try { setSesiones(await getSesionesVirtuales(rutina.id)) }
      catch (err) { console.error(err) }
      finally { setCargando(false) }
    }
  }

  async function agregar() {
    if (!nuevo || !nuevo.titulo.trim()) return
    setGuardando('nuevo')
    try {
      const orden = sesiones?.length ?? 0
      const id = await crearSesionVirtual(rutina.id, { ...nuevo, orden })
      setSesiones((prev) => [...(prev ?? []), {
        id, sesionId: id, ...nuevo, orden, completada: false, completadaEn: null,
        creadoEn: Date.now(), actualizadoEn: Date.now(),
      }])
      setNuevo(null)
    } catch (err) {
      console.error(err)
      alert('No se pudo agregar la sesión.')
    } finally { setGuardando(null) }
  }

  async function guardarEdicion(sesionId: string) {
    setGuardando(sesionId)
    try {
      await actualizarSesionVirtual(rutina.id, sesionId, draft)
      setSesiones((prev) => (prev ?? []).map((s) => (s.id === sesionId ? { ...s, ...draft } : s)))
      setEditando(null)
    } catch (err) {
      console.error(err)
      alert('No se pudo guardar el cambio.')
    } finally { setGuardando(null) }
  }

  async function borrar(sesionId: string) {
    if (!window.confirm('¿Eliminar esta sesión de la rutina?')) return
    setGuardando(sesionId)
    try {
      await eliminarSesionVirtual(rutina.id, sesionId)
      setSesiones((prev) => (prev ?? []).filter((s) => s.id !== sesionId))
    } catch (err) {
      console.error(err)
      alert('No se pudo eliminar.')
    } finally { setGuardando(null) }
  }

  const completadas = (sesiones ?? []).filter((s) => s.completada).length

  return (
    <Card padding="none" className="overflow-hidden">
      <button
        onClick={abrir}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="min-w-0">
          <p className="font-display text-sm font-extrabold text-white uppercase tracking-tight truncate">
            {rutina.nombre_alumno || 'Alumno'}
          </p>
          <p className="text-[11px] text-[var(--color-on-surface-variant)]/60 mt-0.5 truncate">
            {sesiones ? `${completadas} de ${sesiones.length} completadas` : (subtitulo ?? rutina.nombre)}
          </p>
        </div>
        <span className={`material-symbols-outlined text-white/40 transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="p-5 space-y-4">
              {cargando ? (
                <div className="flex justify-center py-6"><Spinner size="sm" /></div>
              ) : (
                <>
                  {(sesiones ?? []).map((s) => (
                    <div key={s.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                      {editando === s.id ? (
                        <div className="space-y-3">
                          <input
                            value={draft.titulo}
                            onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))}
                            placeholder="Título"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
                          />
                          <textarea
                            value={draft.descripcion}
                            onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
                            placeholder="Descripción"
                            rows={2}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none resize-none"
                          />
                          <input
                            value={draft.videoUrl}
                            onChange={(e) => setDraft((d) => ({ ...d, videoUrl: e.target.value }))}
                            placeholder="Link de YouTube o Vimeo"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" loading={guardando === s.id} onClick={() => guardarEdicion(s.id)}>Guardar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {s.completada && <span className="material-symbols-outlined text-[16px] text-[var(--color-success-emerald)]">check_circle</span>}
                              <p className="text-sm font-bold text-white truncate">{s.titulo}</p>
                            </div>
                            {s.descripcion && <p className="text-xs text-white/50 mt-1">{s.descripcion}</p>}
                            {s.videoUrl && (
                              <p className="text-[10px] text-white/30 mt-1 truncate">
                                {embedUrlFromVideoUrl(s.videoUrl) ? 'Video reconocido' : 'Link sin reconocer (se mostrará como link)'} · {s.videoUrl}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => { setEditando(s.id); setDraft({ titulo: s.titulo, descripcion: s.descripcion, videoUrl: s.videoUrl }) }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                              onClick={() => borrar(s.id)}
                              disabled={guardando === s.id}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-[var(--color-danger-crimson)] hover:bg-white/5 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {nuevo ? (
                    <div className="rounded-2xl border border-dashed border-white/15 p-4 space-y-3">
                      <input
                        value={nuevo.titulo}
                        onChange={(e) => setNuevo((n) => ({ ...n!, titulo: e.target.value }))}
                        placeholder="Título de la sesión"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
                      />
                      <textarea
                        value={nuevo.descripcion}
                        onChange={(e) => setNuevo((n) => ({ ...n!, descripcion: e.target.value }))}
                        placeholder="Descripción (opcional)"
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none resize-none"
                      />
                      <input
                        value={nuevo.videoUrl}
                        onChange={(e) => setNuevo((n) => ({ ...n!, videoUrl: e.target.value }))}
                        placeholder="Link de YouTube o Vimeo (opcional)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" loading={guardando === 'nuevo'} disabled={!nuevo.titulo.trim()} onClick={agregar}>Agregar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setNuevo(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNuevo(CAMPO_VACIO)}
                      className="w-full border-2 border-dashed border-white/10 rounded-2xl p-5 text-center hover:border-[rgba(230,255,0,0.4)] hover:bg-white/[0.03] transition-colors group"
                    >
                      <span className="material-symbols-outlined text-white/20 text-2xl block mb-1 group-hover:text-[var(--color-primary-fixed)] transition-colors">add_circle</span>
                      <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60">Agregar sesión</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
