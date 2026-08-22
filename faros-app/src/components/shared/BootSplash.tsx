'use client'

// ============================================================
// FAROS — Splash de entrada (ripple de los anillos del logo real)
// Se monta una sola vez en el layout raíz — NO depende de auth ni de
// la ruta, así que aparece siempre al abrir la app (fría o desde el
// ícono del PWA) y nunca en navegaciones internas (el layout raíz no
// se remonta al cambiar de página).
//
// No hay imagen estática de fondo: los 4 anillos SON el logo, y los 4
// se mueven todo el tiempo (nada se queda quieto). El "hueco" que se
// lee como la silueta del faro no es un dibujo aparte — es el propio
// espacio negativo que dejan los arcos abiertos por abajo, igual que
// en el archivo real (logo-amarillo.png no tiene ni un solo píxel
// negro: se verificó con un histograma de color del PNG).
//
// La geometría de cada anillo se midió directamente del PNG real
// (escaneando filas de píxeles para encontrar los bordes de cada
// arco) en vez de calcarla a ojo — de ahí que "quedaran mal" en el
// primer intento. Los 4 anillos resultaron ser el mismo trazo
// reescalado uniformemente desde un origen común (144.5, 144 en el
// espacio del PNG de 289x233), con factores medidos de 0.552, 1.0,
// 1.441 y 1.883 — eso es lo que anima ANILLOS[].escalaReal más abajo.
//
// El "d" se recalcula a mano en cada frame (useMotionValue + animate()
// + onChange → setAttribute) en vez de dejar que motion interpole dos
// strings de path completos — motion trata "d" como un string opaco,
// no com números, así que animarlo directo saltaba/colapsaba en vez
// de crecer.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react'

const T_FINAL = 2700
const T_OCULTAR = T_FINAL + 650

// Puntos medidos del arco de referencia (el anillo 2 de 4, sin
// escalar) en el espacio de píxeles del PNG real: desde la punta
// abierta izquierda, subiendo por el ápice, bajando a la punta
// abierta derecha. 19 puntos → curva suave vía Catmull-Rom.
const PUNTOS_REFERENCIA: [number, number][] = [
  [107.5, 197], [106, 192], [96.5, 176], [80.5, 160], [72, 144],
  [80, 128], [96, 112], [112, 96], [130.5, 80], [144.5, 64],
  [158.5, 80], [177, 96], [193, 112], [209, 128], [217, 144],
  [208.5, 160], [192.5, 176], [183, 192], [181.5, 197],
]
// Origen de escalado medido — los 4 anillos reales son este mismo
// trazo reescalado uniformemente desde este punto.
const ORIGEN: [number, number] = [144.5, 144]

function escalarPunto([x, y]: [number, number], factor: number): [number, number] {
  return [ORIGEN[0] + (x - ORIGEN[0]) * factor, ORIGEN[1] + (y - ORIGEN[1]) * factor]
}

// Catmull-Rom → Bézier cúbica (extremos clamped). Como el escalado es
// lineal respecto al origen, escalar los puntos y luego construir la
// curva da exactamente la curva original reescalada, sin deformarse.
function trazoDesdePuntos(puntos: [number, number][]): string {
  const n = puntos.length
  const en = (i: number) => puntos[Math.max(0, Math.min(n - 1, i))]
  let d = `M${puntos[0][0].toFixed(2)},${puntos[0][1].toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = en(i - 1), p1 = en(i), p2 = en(i + 1), p3 = en(i + 2)
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`
  }
  return d
}

function trazoAnillo(factor: number): string {
  return trazoDesdePuntos(PUNTOS_REFERENCIA.map((p) => escalarPunto(p, factor)))
}

// Los 4 anillos reales, de adentro hacia afuera — factores de escala
// medidos del PNG (ver comentario de arriba). El interno arranca
// primero y los de afuera se suman con retraso: así se ve la onda
// propagándose en vez de los 4 "parpadeando" juntos.
const ANILLOS = [
  { escalaReal: 0.552 },
  { escalaReal: 1.0 },
  { escalaReal: 1.441 },
  { escalaReal: 1.883 },
]

function OndaRipple({ escalaReal, stagger, destello }: {
  escalaReal: number; stagger: number; destello: boolean
}) {
  const pathRef = useRef<SVGPathElement>(null)
  const factor = useMotionValue(escalaReal * 0.6)

  useEffect(() => {
    const el = pathRef.current
    if (!el) return
    el.setAttribute('d', trazoAnillo(factor.get()))
    const unsub = factor.on('change', (v) => el.setAttribute('d', trazoAnillo(v)))

    const controls = destello
      ? animate(factor, escalaReal * 3.6, { duration: 0.6, ease: 'easeIn', delay: stagger * 0.05 })
      : animate(factor, [escalaReal * 0.6, escalaReal, escalaReal * 1.7], {
          duration: 1.3, times: [0, 0.35, 1], ease: 'easeOut',
          repeat: Infinity, repeatDelay: 0.4, delay: stagger * 0.32,
        })

    return () => { unsub(); controls.stop() }
  }, [destello, escalaReal, stagger, factor])

  return (
    <motion.path
      ref={pathRef}
      fill="none"
      stroke="#e6ff00"
      strokeLinecap="round"
      initial={{ opacity: 0.5, strokeWidth: 15 }}
      animate={destello
        ? { opacity: [0.95, 1, 0], strokeWidth: [15, 190, 190] }
        : { opacity: [0.4, 0.95, 0], strokeWidth: 15 }}
      transition={destello
        ? { duration: 0.6, times: [0, 0.4, 1], ease: 'easeIn', delay: stagger * 0.05 }
        : { duration: 1.3, times: [0, 0.35, 1], ease: 'easeOut', repeat: Infinity, repeatDelay: 0.4, delay: stagger * 0.32 }}
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
          {/* Resplandor ambiental — centrado en el mismo origen que los anillos */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 62%, rgba(230,255,0,0.16), transparent 65%)' }}
            animate={{ opacity: destello ? [0.3, 1, 0] : [0.25, 0.6, 0.25] }}
            transition={destello ? { duration: 0.6 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Los 4 anillos — todos en movimiento, ninguno queda quieto */}
          <svg
            viewBox="0 0 289 233"
            className="relative"
            style={{ width: 260, height: 260 * (233 / 289), overflow: 'visible' }}
          >
            {ANILLOS.map((a, i) => (
              <OndaRipple key={i} escalaReal={a.escalaReal} stagger={i} destello={destello} />
            ))}
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
