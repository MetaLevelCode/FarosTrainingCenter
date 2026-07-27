'use client'

// ============================================================
// FAROS — Pie de página con oleaje
// Barras que ondulan como la superficie de la piscina.
//
// Ajustes de rendimiento sobre el patrón original:
//  · Sin `transition` en las barras: pelea con el rAF (una
//    interpolación por frame que se descarta al frame siguiente).
//  · Sin `will-change` permanente: 23 barras = 23 capas de
//    composición vivas aunque el pie esté fuera de pantalla.
//  · Bucle limitado a 30 fps en móvil (el oleaje es lento, no se
//    nota) y menos barras en pantallas pequeñas.
//  · Se detiene fuera de viewport Y con la pestaña oculta.
//  · Respeta prefers-reduced-motion: queda una onda estática.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FarosLogo } from '@/components/ui'

interface LinkItem { href: string; label: string }

interface Props {
  leftLinks: LinkItem[]
  rightLinks: LinkItem[]
  copyrightText: string
}

export function AnimatedFooter({ leftLinks, rightLinks, copyrightText }: Props) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([])
  const footerRef = useRef<HTMLElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const [visible, setVisible] = useState(false)
  const [barCount, setBarCount] = useState(23)
  const [reduced, setReduced] = useState(false)

  // Menos barras en móvil + respeto a reduced-motion
  useEffect(() => {
    const mqMovil = window.matchMedia('(max-width: 768px)')
    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      setBarCount(mqMovil.matches ? 14 : 23)
      setReduced(mqReduce.matches)
    }
    sync()
    mqMovil.addEventListener('change', sync)
    mqReduce.addEventListener('change', sync)
    return () => {
      mqMovil.removeEventListener('change', sync)
      mqReduce.removeEventListener('change', sync)
    }
  }, [])

  // Sólo anima cuando el pie está a la vista
  useEffect(() => {
    const el = footerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Bucle del oleaje
  useEffect(() => {
    const barras = barsRef.current

    // Reduced motion: una sola pasada estática, sin bucle.
    if (reduced) {
      let offset = 0
      barras.forEach((b, i) => {
        if (!b) return
        offset += Math.max(0, 20 * Math.sin(i * 0.3))
        b.style.transform = `translateY(${i + offset}px)`
      })
      return
    }

    if (!visible) return

    const movil = window.matchMedia('(max-width: 768px)').matches
    const intervalo = 1000 / (movil ? 30 : 60)
    let t = 0
    let ultimo = 0

    const loop = (ahora: number) => {
      rafRef.current = requestAnimationFrame(loop)
      if (ahora - ultimo < intervalo) return
      ultimo = ahora

      let offset = 0
      for (let i = 0; i < barras.length; i++) {
        const b = barras[i]
        if (!b) continue
        offset += Math.max(0, 20 * Math.sin((t + i) * 0.3))
        b.style.transform = `translateY(${i + offset}px)`
      }
      t += 0.1
    }

    rafRef.current = requestAnimationFrame(loop)

    // Pausa también con la pestaña en segundo plano
    const onVis = () => {
      if (document.hidden && rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      } else if (!document.hidden && rafRef.current === null) {
        ultimo = 0
        rafRef.current = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [visible, reduced, barCount])

  return (
    <footer
      ref={footerRef}
      className="relative z-10 w-full flex flex-col justify-between select-none overflow-hidden bg-[#050505] border-t border-[var(--color-surface-stroke)]"
    >
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between w-full gap-8 pt-14 pb-20 px-5 md:px-10">
        {/* Izquierda: legales + marca */}
        <div className="space-y-4">
          <ul className="flex flex-wrap gap-5">
            {leftLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-fixed)] transition-colors duration-200 inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-2 -mx-2"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-sm text-[var(--color-on-surface-variant)]/70 flex items-center gap-2">
            <FarosLogo size={14} />
            {copyrightText}
          </p>
        </div>

        {/* Derecha: navegación + volver arriba */}
        <div className="space-y-4 md:text-right">
          <ul className="flex flex-wrap gap-5 md:justify-end">
            {rightLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-fixed)] transition-colors duration-200 inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-2 -mx-2"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="md:text-right">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="label-caps text-[10px] text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-fixed)] transition-colors duration-200 inline-flex items-center gap-2 min-h-[44px] px-3 -mx-3 rounded-xl"
            >
              Volver arriba
              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            </button>
          </div>
        </div>
      </div>

      {/* Oleaje */}
      <div aria-hidden="true" className="overflow-hidden h-[160px] md:h-[200px]">
        {Array.from({ length: barCount }).map((_, i) => {
          // Del blanco tenue de la espuma al amarillo de marca:
          // da sensación de profundidad al acercarse al borde.
          const p = i / Math.max(1, barCount - 1)
          const color = `color-mix(in srgb, var(--color-primary-fixed) ${Math.round(p * 100)}%, rgba(255,255,255,0.10))`
          return (
            <div
              key={i}
              ref={(el) => { barsRef.current[i] = el }}
              style={{ height: `${i + 1}px`, backgroundColor: color, marginTop: '-2px' }}
            />
          )
        })}
      </div>
    </footer>
  )
}
