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
// marea sube, cubre TODA la pantalla, y sigue bajando hasta salir del
// todo por abajo — la página real queda revelada progresivamente a
// medida que se retira, no con un fundido aparte al final. El fondo
// negro se apaga (opacity→0) escondido bajo el amarillo justo en el
// instante en que la marea cubre completo, para que ese cambio sea
// invisible.
//
// El texto es el mismo del archivo faros-training-brush.jpeg (trazo a
// pincel), pero extraído a PNG transparente — el jpeg original es
// opaco con fondo negro, así que sobre cualquier otro fondo se vería
// como una caja negra. Se generó una vez con un histograma de
// luminosidad (blanco→alpha) y queda commiteado como asset normal.
// ============================================================

import { useEffect, useState } from 'react'

const T_FINAL = 900
const T_OCULTAR = T_FINAL + 1000

export function BootSplash() {
  const [visible, setVisible] = useState(true)
  const [ciclo, setCiclo] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setCiclo(true), T_FINAL)
    const t2 = setTimeout(() => setVisible(false), T_OCULTAR)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[300] overflow-hidden">
      {/* Fondo negro — se apaga escondido bajo la marea cuando cubre
          toda la pantalla, revelando la página real desde ese instante */}
      <div
        className={`absolute inset-0 ${ciclo ? 'faros-fondo--ciclo' : ''}`}
        style={{ background: '#050505' }}
      />

      {/* Logo + texto — quietos, por encima de la marea */}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 px-6 ${ciclo ? 'faros-contenido--ciclo' : ''}`}
      >
        <div className="flex items-center justify-center gap-3 sm:gap-8 max-w-[100vw] px-4">

          <div className="flex flex-col items-center gap-4 sm:gap-6 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/farosWordmark/logo-amarillo.png" alt="" className="w-[60px] sm:w-[92px] h-auto" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/farosWordmark/letras-brush-amarillas.png"
              alt="Faros Training"
              className="w-[140px] sm:w-[260px] h-auto"
            />
          </div>

          <span className="font-display font-black text-white/40 text-sm sm:text-xl shrink-0">X</span>

          <div className="flex items-center opacity-90 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/metalevel-logo.png" alt="MetaLevel Code" className="h-[56px] sm:h-[84px] w-auto object-contain mix-blend-screen" />
          </div>

        </div>
      </div>

      {/* La marea — caja el doble de alta que la pantalla (bottom:0,
          height:200%), anclada abajo. En reposo se empuja hacia abajo
          con translateY para que solo asome una franja; al final sube
          (cubre entera) y sigue bajando hasta quedar del todo fuera
          de pantalla. */}
      <div
        className={`z-20 faros-marea ${ciclo ? 'faros-marea--ciclo' : ''}`}
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
