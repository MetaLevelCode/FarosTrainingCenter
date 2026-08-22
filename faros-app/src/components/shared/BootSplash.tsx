'use client'

// ============================================================
// FAROS — Splash de entrada (faro a pantalla completa)
// Se monta una sola vez en el layout raíz — NO depende de auth ni de
// la ruta, así que aparece siempre al abrir la app (fría, desde el
// ícono del PWA, o recargando) y nunca en navegaciones internas entre
// paneles (el layout raíz no se remonta al cambiar de página).
//
// Secuencia con duración fija (nada de esperar a Firestore/auth, que
// es justo lo que la hacía inconsistente cuando vivía dentro de
// GuardedShell):
//   1. El faro se dibuja y el haz empieza a girar (ambiente).
//   2. El haz se lanza hacia la cámara: crece desde el punto del farol
//      hasta cubrir toda la pantalla y al apagarse revela la app.
// ============================================================

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const T_DESTELLO = 1150
const T_OCULTAR = 1750

export function BootSplash() {
  const [visible, setVisible] = useState(true)
  const [destello, setDestello] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setDestello(true), T_DESTELLO)
    const t2 = setTimeout(() => setVisible(false), T_OCULTAR)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[300] overflow-hidden"
          style={{ background: '#050505' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Contenido: torre del faro + wordmark */}
          <motion.div
            className="relative z-10 h-full flex flex-col items-center justify-center gap-8 px-6"
            animate={{ opacity: destello ? 0 : 1 }}
            transition={{ duration: 0.35, delay: destello ? 0.15 : 0 }}
          >
            {/* Torre + haz: el haz cuelga del mismo contenedor posicionado
                relative para que su origen (left/top en %) quede exacto
                sobre el punto del farol (cx=60,cy=42 de un viewBox 120x200
                → 50%, 21%) sin importar el tamaño de pantalla. */}
            <div className="relative" style={{ width: 190, height: 285, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))' }}>
              {/* Resplandor ambiental, centrado en el farol */}
              <motion.div
                className="absolute"
                style={{
                  left: '50%', top: '21%', width: '120vmax', height: '120vmax',
                  marginLeft: '-60vmax', marginTop: '-60vmax',
                  background: 'radial-gradient(circle, rgba(230,255,0,0.22), transparent 60%)',
                }}
                animate={{ opacity: destello ? 0 : [0.3, 0.85, 0.3] }}
                transition={destello ? { duration: 0.3 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* Haz girando, centrado en el farol. Un conic-gradient es
                  angular — escalar el contenedor no lo agranda a los ojos
                  del espectador (el ángulo desde el centro no cambia), así
                  que en vez de eso acelera su giro al final, como si
                  tomara impulso antes del núcleo de luz. */}
              <motion.div
                className="absolute"
                style={{
                  left: '50%', top: '21%', width: '260vmax', height: '260vmax',
                  marginLeft: '-130vmax', marginTop: '-130vmax',
                  background:
                    'conic-gradient(from 0deg, transparent 0deg, rgba(230,255,0,0.28) 14deg, transparent 42deg, transparent 180deg, rgba(230,255,0,0.28) 194deg, transparent 222deg, transparent 360deg)',
                  filter: 'blur(10px)',
                }}
                animate={{ rotate: 360, opacity: destello ? 0 : 1 }}
                transition={{
                  rotate: { duration: destello ? 0.35 : 3, repeat: Infinity, ease: 'linear' },
                  opacity: { duration: 0.3, delay: destello ? 0.15 : 0 },
                }}
              />

              {/* Núcleo de luz: esto sí es lo que "se acerca a cámara" — un
                  burst radial (sensible a scale, a diferencia del cónico de
                  arriba) que nace del farol y crece hasta tragarse la
                  pantalla. */}
              <motion.div
                className="absolute rounded-full"
                style={{
                  left: '50%', top: '21%', width: '14vmax', height: '14vmax',
                  marginLeft: '-7vmax', marginTop: '-7vmax',
                  background: 'radial-gradient(circle, #ffffff 0%, #f2ff99 30%, #e6ff00 55%, rgba(230,255,0,0) 78%)',
                }}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={destello ? { opacity: [0, 1, 1, 0], scale: [0.3, 1, 15, 19] } : { opacity: 0 }}
                transition={{ duration: 0.62, times: [0, 0.18, 0.78, 1], ease: 'easeIn' }}
              />

              <svg width={190} height={285} viewBox="0 0 120 200" fill="none" className="relative">
                <defs>
                  <linearGradient id="torreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3a3f05" />
                    <stop offset="100%" stopColor="#0a0a02" />
                  </linearGradient>
                  <linearGradient id="techoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4a4f08" />
                    <stop offset="100%" stopColor="#0a0a02" />
                  </linearGradient>
                </defs>

                {/* Sombra de base — lo ancla al piso en vez de flotar */}
                <motion.ellipse
                  cx={60} cy={187} rx={46} ry={7}
                  fill="rgba(230,255,0,0.14)"
                  initial={{ opacity: 0, scaleX: 0.5 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.6, delay: 0.05 }}
                  style={{ transformOrigin: '60px 187px' }}
                />

                {/* Cúpula del farol — curva, no un triángulo recto */}
                <motion.path
                  d="M60,8 C71,8 78,19 78,27 L42,27 C42,19 49,8 60,8 Z"
                  fill="url(#techoGrad)" stroke="#e6ff00" strokeWidth={1.6} strokeLinejoin="round"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                />
                <motion.circle
                  cx={60} cy={9} r={2.2} fill="#e6ff00"
                  initial={{ opacity: 0 }} animate={{ opacity: 0.9 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                />

                {/* Sala de luz con vidrios */}
                <motion.rect
                  x={41} y={27} width={38} height={30} rx={4}
                  fill="#050505" stroke="#e6ff00" strokeWidth={2}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.22 }}
                />
                {[51, 60, 69].map((x, i) => (
                  <motion.line
                    key={x}
                    x1={x} y1={29} x2={x} y2={55}
                    stroke="#e6ff00" strokeWidth={1} opacity={0.3}
                    initial={{ opacity: 0 }} animate={{ opacity: 0.3 }}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
                  />
                ))}

                {/* Foco encendiéndose */}
                <motion.ellipse
                  cx={60} cy={42} rx={8} ry={10}
                  fill="#e6ff00"
                  style={{ transformOrigin: '60px 42px' }}
                  initial={{ opacity: 0.3, scale: 0.7 }}
                  animate={{ opacity: destello ? 1 : [0.45, 1, 0.45], scale: destello ? 1.3 : [0.85, 1.1, 0.85] }}
                  transition={destello
                    ? { duration: 0.3 }
                    : { duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                />

                {/* Galería — saliente que rodea la sala de luz */}
                <motion.rect
                  x={35} y={57} width={50} height={6} rx={2}
                  fill="url(#torreGrad)" stroke="#e6ff00" strokeWidth={1.4}
                  initial={{ opacity: 0, scaleX: 0.6 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.5, delay: 0.28 }}
                  style={{ transformOrigin: '60px 60px' }}
                />
                {[42, 51, 69, 78].map((x, i) => (
                  <motion.line
                    key={x}
                    x1={x} y1={63} x2={x} y2={67}
                    stroke="#e6ff00" strokeWidth={1.2} opacity={0.5}
                    initial={{ opacity: 0 }} animate={{ opacity: 0.5 }}
                    transition={{ duration: 0.3, delay: 0.4 + i * 0.03 }}
                  />
                ))}

                {/* Torre — silueta curva que se ensancha hacia la base, con relleno para leerse como objeto sólido */}
                <motion.path
                  d="M50,67 C42,105 36,145 32,186 L88,186 C84,145 78,105 70,67 Z"
                  fill="url(#torreGrad)" stroke="#e6ff00" strokeWidth={1.8} strokeLinejoin="round"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.32 }}
                />
                {/* Luz de borde — el brillo del farol rozando un costado de la torre */}
                <motion.path
                  d="M68,68 C75,105 80,145 84,184"
                  fill="none" stroke="#e6ff00" strokeWidth={1.4} strokeLinecap="round" opacity={0.55}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.55 }}
                  transition={{ duration: 0.6, delay: 0.55 }}
                />
                {/* Franjas de la torre, siguiendo la curva del ensanche */}
                {[
                  { y: 92, x1: 39, x2: 81 },
                  { y: 122, x1: 36, x2: 84 },
                  { y: 152, x1: 34, x2: 86 },
                ].map((s, i) => (
                  <motion.line
                    key={s.y}
                    x1={s.x1} y1={s.y} x2={s.x2} y2={s.y}
                    stroke="#e6ff00" strokeWidth={1.2} opacity={0.28}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.28 }}
                    transition={{ duration: 0.4, delay: 0.55 + i * 0.07 }}
                  />
                ))}

                {/* Puerta */}
                <motion.path
                  d="M53,186 L53,172 C53,167 56,164 60,164 C64,164 67,167 67,172 L67,186 Z"
                  fill="#050505" stroke="#e6ff00" strokeWidth={1.2} opacity={0.8}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.8 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                />

                {/* Base — plinto que ancla la torre */}
                <motion.rect
                  x={26} y={186} width={68} height={10} rx={3}
                  fill="url(#torreGrad)" stroke="#e6ff00" strokeWidth={1.8}
                  initial={{ opacity: 0, scaleX: 0.5 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.5, delay: 0.62 }}
                  style={{ transformOrigin: '60px 191px' }}
                />
              </svg>
            </div>

            <motion.span
              className="font-display text-4xl font-black uppercase tracking-[0.25em]"
              style={{ color: '#e6ff00' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: destello ? 0 : 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              FAROS
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
