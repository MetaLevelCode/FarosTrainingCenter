'use client'

// ============================================================
// FAROS — Splash de entrada (ripple de los anillos del logo real)
// Se monta una sola vez en el layout raíz — NO depende de auth ni de
// la ruta, así que aparece siempre al abrir la app (fría o desde el
// ícono del PWA) y nunca en navegaciones internas (el layout raíz no
// se remonta al cambiar de página).
//
// No hay imagen estática de fondo: los 4 <path> SON el logo (SVG en
// línea, no <img>) y los 4 se mueven todo el tiempo. El "hueco" que
// se lee como la silueta del faro no es un dibujo aparte — es el
// espacio negativo que dejan los arcos abiertos por abajo, igual que
// en el archivo real (logo-amarillo.png no tiene ni un solo píxel
// negro: se verificó con un histograma de color del PNG).
//
// La geometría de cada anillo se midió directamente del PNG real
// (escaneo de filas de píxeles buscando los bordes de cada arco) en
// vez de calcarla a ojo. Los 4 anillos resultaron ser el mismo trazo
// reescalado uniformemente desde un origen común (144.5, 144 en el
// espacio del PNG de 289x233), con factores medidos de 0.552, 1.0,
// 1.441 y 1.883 — cada <path> se genera UNA vez con su "d" ya
// correcto a esa escala real (nada se recalcula por frame).
//
// La animación es CSS puro (@keyframes en globals.css: .faros-anillo
// / .faros-anillo--climax), no JS por frame — cada anillo anima la
// propiedad `scale` (no `transform: scale()`) con
// vector-effect="non-scaling-stroke" en el <path>, así el trazo
// conserva su grosor exacto sin engordar al crecer. Los delays
// (animationDelay inline, escalonados por anillo) son los que crean
// la onda propagándose de adentro hacia afuera.
// ============================================================

import { useEffect, useMemo, useState } from 'react'

const T_FINAL = 2700
const T_OCULTAR = T_FINAL + 780

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
// trazo reescalado uniformemente desde este punto. Debe coincidir con
// el transform-origin en px que usan las animaciones CSS.
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
// medidos del PNG real. El interno arranca primero (delay 0) y los de
// afuera se suman con retraso creciente: eso es lo que se lee como la
// onda propagándose, no un solo bloque escalando.
const ANILLOS = [0.552, 1.0, 1.441, 1.883]

export function BootSplash() {
  const [visible, setVisible] = useState(true)
  const [destello, setDestello] = useState(false)
  const trazos = useMemo(() => ANILLOS.map((f) => trazoAnillo(f)), [])

  useEffect(() => {
    const t1 = setTimeout(() => setDestello(true), T_FINAL)
    const t2 = setTimeout(() => setVisible(false), T_OCULTAR)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[300] overflow-hidden flex items-center justify-center"
      style={{
        background: '#050505',
        opacity: destello ? 0 : 1,
        transition: 'opacity 0.7s ease',
      }}
    >
      {/* Resplandor ambiental — centrado en el mismo origen que los anillos.
          Se apaga con el fundido del contenedor entero, no por su cuenta. */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 55% at 50% 62%, rgba(230,255,0,0.16), transparent 65%)',
          animation: destello ? 'none' : 'farosGlow 1.6s ease-in-out infinite',
          opacity: destello ? 1 : undefined,
        }}
      />

      {/* Los 4 anillos — SVG en línea, cada <path> independiente y en movimiento */}
      <svg
        viewBox="0 0 289 233"
        style={{ width: 260, height: 260 * (233 / 289), overflow: 'visible' }}
      >
        {trazos.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#e6ff00"
            strokeWidth={15}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className={destello ? 'faros-anillo faros-anillo--climax' : 'faros-anillo'}
            style={{
              transformOrigin: `${ORIGEN[0]}px ${ORIGEN[1]}px`,
              animationDelay: destello ? `${i * 0.05}s` : `${i * 0.32}s`,
            }}
          />
        ))}
      </svg>
    </div>
  )
}
