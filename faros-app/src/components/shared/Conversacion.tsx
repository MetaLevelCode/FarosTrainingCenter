'use client'

// ============================================================
// FAROS — Conversación (estilo Classroom)
// Un mismo hilo sirve para el muro grupal de la clase y para el
// chat privado alumno ↔ profesor: cambia el canal, no el componente.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui'
import { cuando, type Mensaje } from '@/lib/mensajes'

const EASE = [0.22, 1, 0.36, 1] as const

function ini(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export function Conversacion({
  mensajes, yoId, placeholder = 'Escribe un comentario…', vacio = 'Sé el primero en comentar.', onEnviar, alto = 'max-h-[340px]',
}: {
  mensajes: Mensaje[]
  yoId: string
  placeholder?: string
  vacio?: string
  onEnviar: (texto: string) => void
  alto?: string
}) {
  const [texto, setTexto] = useState('')
  const finRef = useRef<HTMLDivElement>(null)

  // Baja al último mensaje al abrir y al enviar.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'nearest' })
  }, [mensajes.length])

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    onEnviar(texto)
    setTexto('')
  }

  return (
    <div className="flex flex-col">
      <div className={`${alto} overflow-y-auto space-y-3 pr-1`}>
        {mensajes.length === 0 && (
          <p className="text-center text-[12px] text-[var(--color-on-surface-variant)]/40 py-8">{vacio}</p>
        )}

        <AnimatePresence initial={false}>
          {mensajes.map((m) => {
            const mio = m.autorId === yoId
            const coach = m.autorRol === 'entrenador'
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                className={`flex gap-3 ${mio ? 'flex-row-reverse' : ''}`}
              >
                <span
                  title={m.autorNombre}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    coach
                      ? 'bg-[var(--color-primary-fixed)] text-black'
                      : 'bg-white/10 text-white border border-white/10'
                  }`}
                >
                  {ini(m.autorNombre)}
                </span>

                <div className={`min-w-0 max-w-[80%] ${mio ? 'items-end text-right' : ''} flex flex-col`}>
                  <div className={`flex items-baseline gap-2 mb-1 ${mio ? 'flex-row-reverse' : ''}`}>
                    <span className="label-caps text-[9px] text-white/70 truncate">
                      {mio ? 'Tú' : m.autorNombre}
                    </span>
                    {coach && !mio && (
                      <span className="label-caps text-[8px] px-1.5 py-0.5 rounded bg-[rgba(230,255,0,0.12)] text-[var(--color-primary-fixed)] shrink-0">
                        Coach
                      </span>
                    )}
                    <span className="text-[9px] text-[var(--color-on-surface-variant)]/35 shrink-0">{cuando(m.ts)}</span>
                  </div>
                  <p
                    className={`text-[13px] leading-relaxed px-4 py-2.5 rounded-2xl break-words ${
                      mio
                        ? 'bg-[rgba(230,255,0,0.1)] border border-[rgba(230,255,0,0.2)] text-white rounded-tr-sm'
                        : 'bg-white/[0.04] border border-white/5 text-[var(--color-on-surface)]/90 rounded-tl-sm'
                    }`}
                  >
                    {m.texto}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={finRef} />
      </div>

      <form onSubmit={enviar} className="flex gap-2 mt-4 pt-4 border-t border-white/5">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(230,255,0,0.5)] focus:outline-none transition-colors"
        />
        <Button type="submit" size="sm" disabled={!texto.trim()} className="!rounded-full shrink-0">
          <span className="material-symbols-outlined text-[18px]">send</span>
        </Button>
      </form>
    </div>
  )
}
