'use client'

// ============================================================
// FAROS — Floating Paths
// Corriente de agua / cardumen: 36 trazos por dirección que se
// dibujan y desplazan en bucle. Adaptado del patrón "Background
// Paths" a la paleta Faros (blanco tenue + Electric Sulfur) y a
// `motion/react`. Respeta prefers-reduced-motion.
// ============================================================

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'

function Corriente({ position }: { position: number }) {
  const [reduced, setReduced] = useState(false)
  // Arranca en 36 (igual que el HTML del servidor) y baja a 18 en
  // móvil tras hidratar: menos trazos = menos CPU y batería, sin
  // provocar un desajuste de hidratación.
  const [total, setTotal] = useState(36)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)

    const ajustar = () => setTotal(window.innerWidth < 768 ? 18 : 36)
    ajustar()
    window.addEventListener('resize', ajustar, { passive: true })

    return () => {
      mq.removeEventListener('change', onChange)
      window.removeEventListener('resize', ajustar)
    }
  }, [])

  const paths = Array.from({ length: total }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
    // Cada ~5 trazos toma el tinte de la marca: sensación de cardumen
    // con destellos, sin saturar la escena.
    sulfur: i % 5 === 0,
    // Duración estable por índice (evita desajustes de hidratación
    // que traería Math.random()).
    dur: 20 + ((i * 7) % 11),
  }))

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        className="w-full h-full"
        viewBox="0 0 696 316"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke={path.sulfur ? '#e6ff00' : '#ffffff'}
            strokeWidth={path.width}
            strokeOpacity={0.06 + path.id * 0.014}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={
              reduced
                ? { pathLength: 1, opacity: 0.4 }
                : { pathLength: 1, opacity: [0.25, 0.55, 0.25], pathOffset: [0, 1, 0] }
            }
            transition={
              reduced
                ? { duration: 0 }
                : { duration: path.dur, repeat: Infinity, ease: 'linear' }
            }
          />
        ))}
      </svg>
    </div>
  )
}

/** Corriente en dos direcciones opuestas — el cruce genera el flujo. */
export function FloatingPaths() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <Corriente position={1} />
      <Corriente position={-1} />
    </div>
  )
}
