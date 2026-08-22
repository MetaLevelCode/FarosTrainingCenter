'use client'

// ============================================================
// FAROS — Splash de entrada (marea amarilla)
// Se monta una sola vez en el layout raíz — NO depende de auth ni de
// la ruta, así que aparece siempre al abrir la app (fría o desde el
// ícono del PWA) y nunca en navegaciones internas (el layout raíz no
// se remonta al cambiar de página).
//
// Logo + texto quietos arriba; abajo, una franja de agua amarilla con
// la superficie ondulando (loop horizontal sin fin). Al final, la
// marea entera sube y se traga la pantalla, revelando la app.
//
// El texto es el mismo del archivo faros-training-brush.jpeg (trazo a
// pincel), pero extraído a PNG transparente — el jpeg original es
// opaco con fondo negro, así que sobre cualquier otro fondo se vería
// como una caja negra. Se generó una vez con un histograma de
// luminosidad (blanco→alpha) y queda commiteado como asset normal.
// ============================================================

import { useEffect, useState } from 'react'

const T_FINAL = 2600
const T_OCULTAR = T_FINAL + 750

export function BootSplash() {
  const [visible, setVisible] = useState(true)
  const [destello, setDestello] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setDestello(true), T_FINAL)
    const t2 = setTimeout(() => setVisible(false), T_OCULTAR)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[300] overflow-hidden"
      style={{
        background: '#050505',
        opacity: destello ? 0 : 1,
        transition: 'opacity 0.65s ease',
      }}
    >
      {/* Logo + texto — quietos, por encima de la marea */}
      <div
        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 px-6"
        style={{
          opacity: destello ? 0 : 1,
          transition: `opacity 0.5s ease ${destello ? '0.15s' : '0s'}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/farosWordmark/logo-amarillo.png" alt="" style={{ width: 92, height: 'auto' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/farosWordmark/letras-brush-amarillas.png"
          alt="Faros Training"
          style={{ width: 260, height: 'auto' }}
        />
      </div>

      {/* La marea — caja el doble de alta que la pantalla (bottom:0,
          height:200%), anclada abajo. En reposo se empuja hacia abajo
          con translateY para que solo asome una franja; al subir,
          translateY baja a ~45% y el cuerpo (mucho más alto que la
          pantalla) la cubre entera. */}
      <div
        className={destello ? 'faros-marea faros-marea--sube' : 'faros-marea'}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '200%' }}
      >
        <svg
          className="faros-ola"
          viewBox="0 0 1200 60"
          preserveAspectRatio="none"
          style={{ position: 'absolute', top: -18, left: 0, width: '200%', height: 40 }}
        >
          <path
            d="M0,30 C150,55 450,5 600,30 C750,55 1050,5 1200,30 L1200,60 L0,60 Z"
            fill="#e6ff00"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0" style={{ top: 4, background: '#e6ff00' }} />
      </div>
    </div>
  )
}
