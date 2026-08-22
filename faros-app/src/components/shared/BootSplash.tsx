'use client'

// ============================================================
// FAROS — Splash de entrada (faro a pantalla completa)
// Se monta una sola vez en el layout raíz — NO depende de auth ni de
// la ruta, así que aparece siempre al abrir la app (fría, desde el
// ícono del PWA, o recargando) y nunca en navegaciones internas entre
// paneles (el layout raíz no se remonta al cambiar de página).
// Duración fija: nada de esperar a Firestore/auth, que es justo lo que
// lo hacía inconsistente cuando vivía dentro de GuardedShell.
// ============================================================

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const DURACION_MS = 1500

export function BootSplash() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), DURACION_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[300] overflow-hidden"
          style={{ background: '#050505' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
        >
          {/* Resplandor ambiental — llena toda la pantalla, no solo un punto */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 34%, rgba(230,255,0,0.22), transparent 65%)' }}
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Haz doble girando — cubre toda la pantalla desde el punto del farol */}
          <motion.div
            className="absolute"
            style={{
              left: '50%',
              top: '34%',
              width: '260vmax',
              height: '260vmax',
              marginLeft: '-130vmax',
              marginTop: '-130vmax',
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(230,255,0,0.30) 14deg, transparent 42deg, transparent 180deg, rgba(230,255,0,0.30) 194deg, transparent 222deg, transparent 360deg)',
              filter: 'blur(10px)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
          />

          {/* Contenido: torre del faro + wordmark */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-10 px-6">
            <div className="relative" style={{ width: 176, height: 264 }}>
              <svg width={176} height={264} viewBox="0 0 100 160" fill="none">
                {/* Techo */}
                <motion.polygon
                  points="50,4 63,20 37,20"
                  fill="#e6ff00"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                />
                {/* Sala de luz */}
                <motion.rect
                  x={40} y={20} width={20} height={17} rx={2}
                  fill="#050505" stroke="#e6ff00" strokeWidth={2}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                />
                {/* Foco encendiéndose */}
                <motion.ellipse
                  cx={50} cy={28.5} rx={5} ry={5}
                  fill="#e6ff00"
                  style={{ transformOrigin: '50px 28.5px' }}
                  animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.15, 0.8] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                />
                {/* Galería */}
                <motion.rect
                  x={33} y={37} width={34} height={5} rx={1.5}
                  fill="#e6ff00" opacity={0.9}
                  initial={{ opacity: 0, scaleX: 0.6 }}
                  animate={{ opacity: 0.9, scaleX: 1 }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                />
                {/* Torre */}
                <motion.path
                  d="M42,42 L58,42 L67,150 L33,150 Z"
                  fill="none" stroke="#e6ff00" strokeWidth={2} strokeLinejoin="round"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                />
                {/* Franjas de la torre */}
                {[70, 95, 120].map((y, i) => (
                  <motion.line
                    key={y}
                    x1={38 + i * 1.5} y1={y} x2={62 - i * 1.5} y2={y}
                    stroke="#e6ff00" strokeWidth={1.4} opacity={0.35}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.35 }}
                    transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                  />
                ))}
                {/* Base */}
                <motion.rect
                  x={27} y={150} width={46} height={8} rx={2}
                  fill="#e6ff00"
                  initial={{ opacity: 0, scaleX: 0.5 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.5, delay: 0.55 }}
                  style={{ transformOrigin: '50px 154px' }}
                />
              </svg>
            </div>

            <motion.span
              className="label-caps text-[13px] text-white/70 tracking-[0.4em]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              FAROS TRAINING
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
