'use client'

// ============================================================
// FAROS — Estudiante · Plan Virtual
// Rutina remota asignada por un profesor: sesiones con video
// (YouTube/Vimeo embebido), descripción, y un check para marcar cada
// una como completada. Sin calendario ni reserva — acceso ilimitado
// mientras el plan esté activo.
// ============================================================

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Spinner } from '@/components/ui'
import { getRutinaAlumno, getSesionesVirtuales, marcarSesionVirtual } from '@/lib/firestore'
import { embedUrlFromVideoUrl } from '@/lib/video'
import type { RutinaVirtual, SesionVirtual } from '@/lib/types'

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

export default function PlanVirtualPage() {
  const { authorized, loading, user } = useRoleGuard(['estudiante'])
  const [cargando, setCargando] = useState(true)
  const [rutina, setRutina] = useState<RutinaVirtual | null>(null)
  const [sesiones, setSesiones] = useState<SesionVirtual[]>([])
  const [marcando, setMarcando] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    getRutinaAlumno(user.uid)
      .then(async (r) => {
        setRutina(r)
        if (r) setSesiones(await getSesionesVirtuales(r.id))
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [user?.uid])

  async function toggle(sesion: SesionVirtual) {
    if (!rutina) return
    const nuevoValor = !sesion.completada
    setMarcando(sesion.id)
    setSesiones((prev) => prev.map((s) => (
      s.id === sesion.id ? { ...s, completada: nuevoValor, completadaEn: nuevoValor ? Date.now() : null } : s
    )))
    try {
      await marcarSesionVirtual(rutina.id, sesion.id, nuevoValor)
    } catch (err) {
      console.error(err)
      setSesiones((prev) => prev.map((s) => (s.id === sesion.id ? sesion : s))) // revertir
    } finally {
      setMarcando(null)
    }
  }

  const completadas = sesiones.filter((s) => s.completada).length
  const pct = sesiones.length > 0 ? Math.round((completadas / sesiones.length) * 100) : 0

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Plan Virtual">
      <div className="space-y-8">
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Rutina remota</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Plan Virtual
            </h2>
          </div>
        </Reveal>

        {cargando ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : !rutina ? (
          <Reveal delay={0.1}>
            <Card>
              <p className="text-center text-sm text-[var(--color-on-surface-variant)]/60 py-10">
                Aún no tienes una rutina virtual asignada. Si acabas de solicitar el
                plan, tu entrenador la arma en cuanto se apruebe tu pago.
              </p>
            </Card>
          </Reveal>
        ) : (
          <>
            <Reveal delay={0.1}>
              <Card>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="font-display text-xl font-black text-white uppercase tracking-tight">{rutina.nombre}</p>
                    {rutina.nombre_profesor && (
                      <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1">
                        Con {rutina.nombre_profesor}
                      </p>
                    )}
                  </div>
                  <span className="label-caps text-[10px] text-[var(--color-primary-fixed)] shrink-0">
                    {completadas} de {sesiones.length} completadas
                  </span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: EASE }}
                    className="h-full bg-[var(--color-primary-fixed)] shadow-[0_0_15px_rgba(230,255,0,0.4)] rounded-full"
                  />
                </div>
              </Card>
            </Reveal>

            {sesiones.length === 0 ? (
              <Reveal delay={0.15}>
                <Card>
                  <p className="text-center text-sm text-[var(--color-on-surface-variant)]/60 py-10">
                    Tu entrenador todavía no sube sesiones a tu rutina.
                  </p>
                </Card>
              </Reveal>
            ) : (
              <div className="space-y-5">
                <AnimatePresence initial={false}>
                  {sesiones.map((s, i) => {
                    const embed = embedUrlFromVideoUrl(s.videoUrl)
                    return (
                      <Reveal key={s.id} delay={0.05 * i}>
                        <Card padding="none" className="overflow-hidden">
                          {embed ? (
                            <div className="aspect-video w-full bg-black">
                              <iframe
                                src={embed}
                                title={s.titulo}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          ) : s.videoUrl ? (
                            <a
                              href={s.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-5 text-sm text-[var(--color-primary-fixed)] hover:underline"
                            >
                              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                              Ver video
                            </a>
                          ) : null}

                          <div className="p-6 flex items-start gap-4">
                            <button
                              onClick={() => toggle(s)}
                              disabled={marcando === s.id}
                              aria-pressed={s.completada}
                              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 border transition-colors ${
                                s.completada
                                  ? 'bg-[var(--color-primary-fixed)] border-transparent text-black'
                                  : 'border-white/20 text-transparent hover:border-white/40'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[18px]">check</span>
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className={`font-display font-black uppercase tracking-tight ${s.completada ? 'text-white/50 line-through' : 'text-white'}`}>
                                {s.titulo}
                              </p>
                              {s.descripcion && (
                                <p className="text-sm text-[var(--color-on-surface-variant)]/70 mt-1">{s.descripcion}</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      </Reveal>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </GuardedShell>
  )
}
