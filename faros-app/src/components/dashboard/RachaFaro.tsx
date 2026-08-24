'use client'

// ============================================================
// FAROS — Racha semanal, visualizada como un faro encendido
// En vez de un emoji de fuego genérico: un beacon con glow pulsante +
// haz de luz girando (conic-gradient enmascarado a anillo), en el
// amarillo-lima de marca — mismo lenguaje visual que ya usa el resto de
// la app (shadow glow, EASE, motion) en vez de un ícono de stock.
// ============================================================

import { motion } from 'motion/react'

const MASK = 'radial-gradient(circle, transparent 62%, black 63%, black 100%)'

export function RachaFaro({ racha }: { racha: number }) {
  const activa = racha > 0
  const label =
    racha === 0 ? 'Faro apagado' : racha === 1 ? '1 semana seguida' : `${racha} semanas seguidas`
  const sub = activa ? 'Sigue así para mantenerlo encendido' : 'Asiste esta semana para encenderlo'

  return (
    <div className="flex items-center gap-5">
      <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
        {activa && (
          <>
            {/* Glow de fondo, respirando */}
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(230,255,0,0.4), transparent 70%)' }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Haz de luz girando — anillo, no disco completo */}
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, rgba(230,255,0,0.9), transparent 35%, transparent 65%, rgba(230,255,0,0.9))',
                WebkitMaskImage: MASK,
                maskImage: MASK,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
            />
          </>
        )}
        <div
          className={`relative w-14 h-14 rounded-full flex items-center justify-center font-display text-2xl font-black transition-colors duration-500 ${
            activa
              ? 'bg-[var(--color-primary-fixed)] text-black shadow-[0_0_30px_rgba(230,255,0,0.5)]'
              : 'bg-white/10 text-white/40 border border-white/10'
          }`}
        >
          {racha}
        </div>
      </div>
      <div>
        <span className="label-caps text-[11px] text-white block">{label}</span>
        <span className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 block mt-0.5">
          {sub}
        </span>
      </div>
    </div>
  )
}
