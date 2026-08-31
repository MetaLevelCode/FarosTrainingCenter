'use client'

// ============================================================
// FAROS — Muro de opiniones (marquee vertical en 3D)
// Columnas que se desplazan en sentidos alternos, inclinadas en
// perspectiva. Sustituye a la antigua sección de acceso por rol.
//
// Decisiones de rendimiento:
//  · Sólo se anima `transform` → corre en el compositor.
//  · Avatares con iniciales (como en el resto de la app): cero
//    peticiones de red frente a decenas de fotos externas.
//  · Sin backdrop-filter en las tarjetas: son muchas y el blur
//    por capa es lo más caro en gama media.
//  · Móvil: 2 columnas en vez de 4 y una repetición menos.
//  · Pausa al pasar el cursor; respeta prefers-reduced-motion.
//
// ⚠️ Los testimonios son CONTENIDO DE MUESTRA. Reemplazar por
// opiniones reales de atletas antes de publicar el sitio.
// ============================================================

import { useEffect, useState } from 'react'

interface Opinion {
  nombre: string
  usuario: string
  texto: string
  ciudad: string
}

const OPINIONES: Opinion[] = [
  { nombre: 'Camila Herrera', usuario: '@cami', texto: 'Bajé 4 segundos en los 100 libres en dos meses. El plan por frecuencia se ajustó a mi horario de universidad.', ciudad: 'Pereira' },
  { nombre: 'Julián Ospina', usuario: '@julio', texto: 'Venía del gimnasio y no sabía nadar bien. El grupo de iniciación me recibió sin pena ninguna.', ciudad: 'Dosquebradas' },
  { nombre: 'Marcela Ríos', usuario: '@mar', texto: 'Llevo a mis dos hijos a vacaciones deportivas. Salen felices y duermen como piedras.', ciudad: 'Pereira' },
  { nombre: 'Andrés Gallego', usuario: '@andres', texto: 'La asistencia y los tiempos quedan registrados. Ver el progreso semana a semana motiva un montón.', ciudad: 'Santa Rosa' },
  { nombre: 'Valentina Cardona', usuario: '@valen', texto: 'Entrenamos en pareja y pagamos por persona. Salió más económico de lo que pensábamos.', ciudad: 'Pereira' },
  { nombre: 'Sebastián Mejía', usuario: '@sebas', texto: 'El coach corrige técnica en el agua, no desde la orilla. Se nota la diferencia.', ciudad: 'La Virginia' },
  { nombre: 'Daniela Restrepo', usuario: '@dani', texto: 'Combiné natación con acuagym por una lesión de rodilla. Volví a entrenar sin dolor.', ciudad: 'Pereira' },
  { nombre: 'Tomás Arango', usuario: '@tomi', texto: 'Los horarios de la sede UTP me quedan de camino a la casa. Sin excusas.', ciudad: 'Pereira' },
  { nombre: 'Laura Betancur', usuario: '@lau', texto: 'Armé el plan desde el celular en dos minutos y me confirmaron el cupo el mismo día.', ciudad: 'Cartago' },
]

// Dos degradados cruzados: uno vertical y otro horizontal. Combinados
// con `intersect` recortan suavemente los cuatro bordes a la vez.
const MASCARA = [
  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 10%, #000 30%, #000 70%, rgba(0,0,0,0.4) 90%, transparent 100%)',
  'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 8%, #000 22%, #000 78%, rgba(0,0,0,0.5) 92%, transparent 100%)',
].join(', ')

function iniciales(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function TarjetaOpinion({ o }: { o: Opinion }) {
  return (
    <figure className="w-[248px] shrink-0 rounded-2xl border border-white/8 bg-white/[0.035] p-5">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-[rgba(230,255,0,0.12)] border border-[rgba(230,255,0,0.25)] flex items-center justify-center text-[11px] font-black text-[var(--color-primary-fixed)] shrink-0">
          {iniciales(o.nombre)}
        </span>
        <div className="min-w-0">
          <figcaption className="text-sm font-bold text-white truncate">{o.nombre}</figcaption>
          <p className="text-[11px] text-[var(--color-on-surface-variant)]/60 truncate">
            {o.usuario} · {o.ciudad}
          </p>
        </div>
      </div>
      <blockquote className="mt-3 text-[13px] leading-relaxed text-[var(--color-on-surface-variant)]/85">
        {o.texto}
      </blockquote>
    </figure>
  )
}

function Columna({ reverse, duracion, repeticiones }: {
  reverse?: boolean; duracion: string; repeticiones: number
}) {
  return (
    <div className="flex flex-col gap-4 overflow-hidden">
      {Array.from({ length: repeticiones }).map((_, i) => (
        <div
          key={i}
          className={`marquee-col flex shrink-0 flex-col gap-4 ${reverse ? 'is-reverse' : ''}`}
          style={{ ['--duration' as string]: duracion }}
        >
          {OPINIONES.map((o) => <TarjetaOpinion key={o.usuario} o={o} />)}
        </div>
      ))}
    </div>
  )
}

export function TestimonialsMarquee() {
  const [columnas, setColumnas] = useState(4)
  const [repeticiones, setRepeticiones] = useState(3)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => {
      setColumnas(mq.matches ? 2 : 4)
      setRepeticiones(mq.matches ? 2 : 3)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return (
    <section id="opiniones" className="py-24 px-5 md:px-10 max-w-[1400px] mx-auto">
      <div className="text-center mb-14">
        <p className="label-caps text-[var(--color-primary-fixed)] mb-4 tracking-[0.3em]">
          Comentarios
        </p>
        <h2 className="font-display text-headline-lg font-black text-white uppercase tracking-tight">
          Lo que dicen en los{' '}
          <span className="text-[var(--color-primary-fixed)]">entrenamientos</span>
        </h2>
      </div>

      {/* Máscara en degradado: difumina el propio contenido en los
          cuatro bordes, así no se ve dónde empieza ni dónde termina.
          Es más limpio que superponer franjas opacas. */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={pausado}
        aria-label={pausado ? 'Reanudar opiniones' : 'Pausar opiniones'}
        onClick={() => setPausado((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPausado((p) => !p) }
        }}
        className={`marquee-group relative flex h-[420px] md:h-[520px] w-full items-center justify-center overflow-hidden cursor-pointer [perspective:320px] ${pausado ? 'is-paused' : ''}`}
        style={{
          maskImage: MASCARA,
          WebkitMaskImage: MASCARA,
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
        }}
      >
        <div
          className="flex flex-row gap-4"
          style={{
            transform:
              'translateX(-40px) translateZ(-90px) rotateX(18deg) rotateY(-10deg) rotateZ(18deg)',
          }}
        >
          {Array.from({ length: columnas }).map((_, i) => (
            <Columna
              key={i}
              reverse={i % 2 === 1}
              duracion={`${38 + i * 6}s`}
              repeticiones={repeticiones}
            />
          ))}
        </div>
      </div>

      <p className="text-center label-caps text-[9px] text-[var(--color-on-surface-variant)]/40 mt-6">
        {pausado ? 'Toca para reanudar' : 'Toca para pausar'}
      </p>
    </section>
  )
}
