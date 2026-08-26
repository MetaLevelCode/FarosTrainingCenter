'use client'

// ============================================================
// FAROS — Admin · Sugerencias
// Inbox de sugerencias enviadas por los usuarios.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { Card, Badge, Button, Spinner } from '@/components/ui'
import { getTodasSugerencias, responderSugerencia } from '@/lib/firestore'
import type { Sugerencia } from '@/lib/types'

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

export default function SugerenciasAdminPage() {
  const { authorized, loading } = useRoleGuard(['admin'])
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<'pendientes' | 'respondidas'>('pendientes')
  const [respuestaAbierta, setRespuestaAbierta] = useState<string | null>(null)
  const [respuestaText, setRespuestaText] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetchSugerencias()
  }, [])

  async function fetchSugerencias() {
    setCargando(true)
    try {
      const res = await getTodasSugerencias()
      setSugerencias(res)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const visibles = useMemo(() => {
    return sugerencias.filter((s) => {
      if (filtro === 'pendientes') return !s.respuesta
      if (filtro === 'respondidas') return !!s.respuesta
      return true
    })
  }, [sugerencias, filtro])

  async function handleResponder(sId: string) {
    if (!respuestaText.trim()) return
    setEnviando(true)
    try {
      await responderSugerencia(sId, respuestaText.trim())
      await fetchSugerencias()
      setRespuestaAbierta(null)
      setRespuestaText('')
    } catch (err) {
      console.error(err)
      alert('Error al enviar respuesta.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Sugerencias">
      <div className="space-y-8">

        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Voz del Atleta</p>
              <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
                Sugerencias
              </h2>
            </div>
            <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl" role="group">
              {(['pendientes', 'respondidas'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setFiltro(r)}
                  aria-pressed={filtro === r}
                  className={`px-5 py-2 text-[10px] font-black rounded-lg uppercase tracking-widest transition-colors duration-200 ${
                    filtro === r
                      ? 'bg-[var(--color-primary-fixed)] text-black shadow-[0_0_15px_rgba(230,255,0,0.2)]'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {r === 'pendientes' ? 'Pendientes' : 'Respondidas'}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {cargando ? (
          <Reveal delay={0.1}>
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          </Reveal>
        ) : visibles.length === 0 ? (
          <Reveal delay={0.1}>
            <Card className="text-center py-20">
              <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/30 text-5xl mb-4">forum</span>
              <p className="text-[var(--color-on-surface-variant)]/60 text-sm">
                No hay sugerencias {filtro} en este momento.
              </p>
            </Card>
          </Reveal>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibles.map((s, i) => (
              <Reveal key={s.id} delay={0.05 * i}>
                <Card className="h-full flex flex-col relative overflow-hidden group">
                  {/* Decorative glow */}
                  <div className={`absolute -inset-x-20 -top-20 h-[150px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl pointer-events-none rounded-full ${
                    !s.respuesta ? 'bg-[var(--color-primary-fixed)]/5' : 'bg-white/5'
                  }`} />
                  
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div>
                      <p className="font-bold text-white text-sm">{s.displayName}</p>
                      <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-1 truncate max-w-[150px]">
                        ID: {s.uid}
                      </p>
                    </div>
                    <Badge variant={!s.respuesta ? 'primary' : 'default'} className="shrink-0">
                      {new Date(s.createdAt).toLocaleDateString('es-CO')}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 relative z-10">
                    <p className="text-sm text-white/80 leading-relaxed bg-white/5 border border-white/10 rounded-xl p-4 italic">
                      "{s.mensaje}"
                    </p>
                  </div>

                  {s.respuesta ? (
                    <div className="mt-5 pt-5 border-t border-white/10 relative z-10">
                      <p className="label-caps text-[9px] text-[var(--color-success-emerald)] mb-2">Tu respuesta</p>
                      <p className="text-sm text-white/70">
                        {s.respuesta}
                      </p>
                      <p className="label-caps text-[8px] text-[var(--color-on-surface-variant)]/40 mt-3">
                        {s.respondidaAt ? new Date(s.respondidaAt).toLocaleDateString('es-CO') : ''}
                      </p>
                    </div>
                  ) : respuestaAbierta === s.id ? (
                    <div className="mt-5 pt-5 border-t border-[var(--color-primary-fixed)]/20 relative z-10">
                      <textarea
                        value={respuestaText}
                        onChange={(e) => setRespuestaText(e.target.value)}
                        placeholder="Escribe tu respuesta aquí..."
                        className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--color-primary-fixed)] focus:ring-1 focus:ring-[var(--color-primary-fixed)]/50 transition-all resize-none h-24 mb-3"
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => { setRespuestaAbierta(null); setRespuestaText(''); }}
                          disabled={enviando}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          size="sm" 
                          fullWidth 
                          onClick={() => handleResponder(s.id!)}
                          disabled={!respuestaText.trim()}
                          loading={enviando}
                        >
                          Enviar respuesta
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 relative z-10">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        fullWidth 
                        onClick={() => { setRespuestaAbierta(s.id!); setRespuestaText(''); }}
                      >
                        <span className="material-symbols-outlined text-[16px] mr-2">reply</span>
                        Responder
                      </Button>
                    </div>
                  )}
                </Card>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </GuardedShell>
  )
}
