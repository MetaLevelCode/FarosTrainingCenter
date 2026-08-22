'use client'

// ============================================================
// FAROS — Splash de entrada (ripple del logo real)
// Se monta una sola vez en el layout raíz — NO depende de auth ni de
// la ruta, así que aparece siempre al abrir la app (fría o desde el
// ícono del PWA) y nunca en navegaciones internas (el layout raíz no
// se remonta al cambiar de página).
//
// El objeto central es el logo real (public/farosWordmark/logo-
// amarillo.png), estático — el espacio negro de la silueta del faro
// nunca se mueve. Por encima, 4 ondas (el mismo trazo redondeado que
// forman los anillos del logo) nacen del centro y viajan hacia afuera
// en cascada, creciendo y perdiendo opacidad, como ondas en el agua.
//
// El trazo se re-escala en JS (no con transform-origin de CSS, que es
// ambiguo en SVG entre navegadores) generando el mismo "d" a distintos
// factores desde un origen fijo — así cada onda conserva exactamente
// la misma geometría en cualquier tamaño.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const T_FINAL = 2450
const T_OCULTAR = T_FINAL + 650

// Puntos del trazo base (M + 2 curvas cúbicas) en un viewBox 200x160.
// Un solo arco redondeado, abierto abajo — igual que los anillos del
// logo real.
const PUNTOS: [number, number][] = [
  [24, 132], [40, 88], [72, 26], [100, 14], [128, 26], [160, 88], [176, 132],
]
const ORIGEN: [number, number] = [100, 100]

function escalarPunto([x, y]: [number, number], factor: number): [number, number] {
  return [ORIGEN[0] + (x - ORIGEN[0]) * factor, ORIGEN[1] + (y - ORIGEN[1]) * factor]
}

function trazoAnillo(factor: number): string {
  const [p0, p1, p2, p3, p4, p5, p6] = PUNTOS.map((p) => escalarPunto(p, factor))
  return `M${p0[0]},${p0[1]} C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]} C${p4[0]},${p4[1]} ${p5[0]},${p5[1]} ${p6[0]},${p6[1]}`
}

function OndaRipple({ stagger, destello }: { stagger: number; destello: boolean }) {
  const dReposo = useMemo(() => [trazoAnillo(0.42), trazoAnillo(0.42), trazoAnillo(1.55)], [])
  const dClimax = useMemo(() => trazoAnillo(2.7), [])

  return (
    <motion.path
      fill="none"
      stroke="#e6ff00"
      strokeLinecap="round"
      initial={{ d: dReposo[0], opacity: 0, strokeWidth: 9 }}
      animate={destello
        ? { d: dClimax, opacity: [0.95, 1, 0], strokeWidth: [9, 210, 210] }
        : { d: dReposo, opacity: [0, 0.85, 0], strokeWidth: 9 }}
      transition={destello
        ? { duration: 0.6, times: [0, 0.4, 1], ease: 'easeIn', delay: stagger * 0.25 }
        : { duration: 1.1, times: [0, 0.15, 1], ease: 'easeOut', repeat: Infinity, repeatDelay: 0.5, delay: stagger * 0.28 }}
    />
  )
}

export function BootSplash() {
  const [visible, setVisible] = useState(true)
  const [destello, setDestello] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setDestello(true), T_FINAL)
    const t2 = setTimeout(() => setVisible(false), T_OCULTAR)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[300] overflow-hidden flex items-center justify-center"
          style={{ background: '#050505' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Resplandor ambiental detrás del logo */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(230,255,0,0.16), transparent 65%)' }}
            animate={{ opacity: destello ? [0.3, 1, 0] : [0.25, 0.6, 0.25] }}
            transition={destello ? { duration: 0.6 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* El logo real, estático — nunca se mueve */}
          <motion.div
            className="relative"
            style={{ width: 220, height: 178 }}
            animate={{ opacity: destello ? 0 : 1 }}
            transition={{ duration: 0.35, delay: destello ? 0.2 : 0.15 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/farosWordmark/logo-amarillo.png"
              alt="Faros"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 0 18px rgba(230,255,0,0.35))' }}
            />

            {/* Las ondas: mismo trazo redondeado de los anillos, en cascada */}
            <svg viewBox="0 0 200 160" className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
              {[0, 1, 2, 3].map((i) => (
                <OndaRipple key={i} stagger={i} destello={destello} />
              ))}
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
