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
// nunca se mueve. Por encima, 4 anillos —cada uno su propio elemento,
// con su propio radio de reposo, igual que los 4 anillos reales
// anidados— nacen del centro y se propagan hacia afuera en cascada,
// creciendo y perdiendo opacidad, como ondas en el agua.
//
// El "d" del path se recalcula a mano en cada frame (ver useMotionValue
// + animate() más abajo) en vez de dejar que la librería intente
// interpolar dos strings de path completos: motion no interpola el
// contenido de un "d" arbitrario (son strings opacos para ella), así
// que animar `d: [stringA, stringB]` directamente saltaba entre
// valores en vez de crecer — por eso se veía "colapsar" en lugar de
// expandirse. Animando un número (el factor de escala) con motion y
// aplicándolo nosotros mismos al "d" en cada tick, la geometría se
// re-escala de verdad, con cada anillo conservando su forma exacta.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react'

const T_FINAL = 2600
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

// Cada anillo es un elemento independiente con su propio radio de
// reposo (como los 4 anillos reales, anidados) — no son 4 copias
// idénticas con solo un desfase de tiempo.
const ANILLOS = [
  { base: 0.32, crecimiento: 2.2 },
  { base: 0.48, crecimiento: 2.05 },
  { base: 0.64, crecimiento: 1.9 },
  { base: 0.8, crecimiento: 1.8 },
]

function OndaRipple({ base, crecimiento, stagger, destello }: {
  base: number; crecimiento: number; stagger: number; destello: boolean
}) {
  const pathRef = useRef<SVGPathElement>(null)
  const factor = useMotionValue(base)

  useEffect(() => {
    const el = pathRef.current
    if (!el) return
    el.setAttribute('d', trazoAnillo(factor.get()))
    const unsub = factor.on('change', (v) => el.setAttribute('d', trazoAnillo(v)))

    // El anillo interno arranca primero; los de afuera se suman con
    // retraso — así se ve la onda propagándose en vez de "parpadear"
    // los 4 a la vez.
    const controls = destello
      ? animate(factor, base * 3.4, { duration: 0.6, ease: 'easeIn', delay: stagger * 0.05 })
      : animate(factor, [base, base, base * crecimiento], {
          duration: 1.15, times: [0, 0.15, 1], ease: 'easeOut',
          repeat: Infinity, repeatDelay: 0.45, delay: stagger * 0.3,
        })

    return () => { unsub(); controls.stop() }
  }, [destello, base, crecimiento, stagger, factor])

  return (
    <motion.path
      ref={pathRef}
      fill="none"
      stroke="#e6ff00"
      strokeLinecap="round"
      initial={{ opacity: 0, strokeWidth: 9 }}
      animate={destello
        ? { opacity: [0.95, 1, 0], strokeWidth: [9, 180, 180] }
        : { opacity: [0, 0.85, 0], strokeWidth: 9 }}
      transition={destello
        ? { duration: 0.6, times: [0, 0.4, 1], ease: 'easeIn', delay: stagger * 0.05 }
        : { duration: 1.15, times: [0, 0.15, 1], ease: 'easeOut', repeat: Infinity, repeatDelay: 0.45, delay: stagger * 0.3 }}
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

            {/* Los anillos: cada uno un elemento propio, con su radio de reposo */}
            <svg viewBox="0 0 200 160" className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
              {ANILLOS.map((a, i) => (
                <OndaRipple key={i} base={a.base} crecimiento={a.crecimiento} stagger={i} destello={destello} />
              ))}
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
