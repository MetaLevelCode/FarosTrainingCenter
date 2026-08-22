'use client'

// ============================================================
// FAROS — Loader de arranque (faro encendiéndose)
// Se muestra mientras se resuelve la sesión (GuardedShell). Al salir
// (AnimatePresence exit), hace zoom hacia el foco de luz en vez de un
// simple fundido, para que la transición a la app se sienta continua
// en vez de un salto entre pantallas.
// ============================================================

import { motion } from 'motion/react'

export function LighthouseLoader() {
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6"
      style={{ background: '#050505' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 5 }}
      transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Haz de luz girando, como el barrido de un faro real */}
        <motion.div
          className="absolute inset-[-60%] rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(230,255,0,0.35) 18deg, transparent 50deg, transparent 360deg)',
            filter: 'blur(8px)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        />

        {/* Resplandor que respira: el foco "encendiéndose" */}
        <motion.div
          className="absolute w-16 h-16 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(230,255,0,0.55), transparent 70%)',
            filter: 'blur(3px)',
          }}
          animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.2, 0.85] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Rombos concéntricos del logo, entrando en cascada */}
        <svg width={112} height={112} viewBox="0 0 32 32" fill="none" className="relative z-10">
          <motion.path
            d="M16 2 L28 11 L28 24 L16 30 L4 24 L4 11 Z"
            stroke="#e6ff00" strokeWidth={1.4} strokeLinejoin="round" fill="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          />
          <motion.path
            d="M16 6 L25 13 L25 22 L16 27 L7 22 L7 13 Z"
            stroke="#e6ff00" strokeWidth={1.2} strokeLinejoin="round" fill="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          />
          <motion.path
            d="M16 10 L22 15 L22 21 L16 24 L10 21 L10 15 Z"
            stroke="#e6ff00" strokeWidth={1} strokeLinejoin="round" fill="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <motion.ellipse
            cx={16} cy={19} rx={3.5} ry={6} fill="#e6ff00"
            style={{ transformOrigin: '16px 19px' }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
          />
          <ellipse cx={16} cy={16} rx={2.5} ry={2.5} fill="#050505" />
        </svg>
      </div>

      <motion.span
        className="label-caps text-[11px] text-white/60 tracking-[0.35em]"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        FAROS TRAINING
      </motion.span>
    </motion.div>
  )
}
