'use client'

// ============================================================
// FAROS — CTA "¡Inscríbete ahora!"
// Adaptado del patrón "Let's work together": heading con slide en
// hover, líneas laterales y botón circular. Al hacer clic dispara
// una ONDA DE AGUA (ripple concéntrico en Electric Sulfur) y navega
// al flujo "Arma tu plan" (abierto a invitados). Reemplaza la
// antigua sección de planes fija.
// Luz trasera: glow radial suave que se funde con el entorno
// (sin caja recortada). Sin neón agresivo.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const EASE_CSS = 'cubic-bezier(0.16,1,0.3,1)'

export function NadarCTA({ href = '/dashboard/planes' }: { href?: string }) {
  const router = useRouter()
  const [isHovered, setIsHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)

  function handleClick() {
    if (isClicked) return
    setIsClicked(true)
    setTimeout(() => router.push(href), 720)
  }

  return (
    <section
      id="planes"
      className="relative min-h-[72vh] flex items-center justify-center px-5 md:px-10 py-28 overflow-hidden"
    >
      {/* Luz trasera: glow radial suave, transparente antes del borde →
          no se ve recortado y transiciona con las secciones vecinas. */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 46%, rgba(230,255,0,0.045), transparent 70%)' }}
      />

      <div className="relative z-10 flex flex-col items-center gap-9 text-center">
        {/* Parte superior: la pregunta */}
        <p className="font-body text-lg md:text-2xl text-[var(--color-on-surface-variant)] max-w-xl leading-snug">
          ¿Listo para bajar tus tiempos y subir el nivel?
        </p>

        <div
          className="group relative cursor-pointer select-none"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
          role="button"
          tabIndex={0}
          aria-label="Inscríbete ahora — arma tu plan"
          style={{ pointerEvents: isClicked ? 'none' : 'auto' }}
        >
          <div className="flex flex-col items-center gap-9">
            {/* Parte central: la llamada a la acción */}
            <h2
              className="relative text-center font-display font-black uppercase tracking-tighter text-white leading-[0.92] text-[clamp(2.75rem,10vw,6.5rem)] transition-all duration-700"
              style={{
                transitionTimingFunction: EASE_CSS,
                opacity: isClicked ? 0 : 1,
                transform: isClicked ? 'translateY(-40px) scale(0.95)' : 'translateY(0) scale(1)',
              }}
            >
              <span className="block overflow-hidden pb-1">
                <span
                  className="block transition-transform duration-700"
                  style={{ transitionTimingFunction: EASE_CSS, transform: isHovered && !isClicked ? 'translateY(-8%)' : 'translateY(0)' }}
                >
                  ¡Inscríbete
                </span>
              </span>
              <span className="block overflow-hidden pb-1">
                <span
                  className="block transition-transform duration-700 delay-75"
                  style={{ transitionTimingFunction: EASE_CSS, transform: isHovered && !isClicked ? 'translateY(-8%)' : 'translateY(0)' }}
                >
                  <span className="text-[var(--color-primary-fixed)]">ahora!</span>
                </span>
              </span>
            </h2>

            {/* Botón circular + onda de agua */}
            <div className="relative mt-2 flex size-16 sm:size-20 items-center justify-center">
              {/* Ondas de agua (ripple) al hacer clic */}
              {isClicked && (
                <>
                  <span className="absolute inset-0 rounded-full bg-[rgba(230,255,0,0.14)]" style={{ animation: `waterSplash 0.9s ${EASE_CSS} forwards` }} />
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="absolute inset-0 rounded-full border-2 border-[var(--color-primary-fixed)]"
                      style={{ animation: `waterRipple 0.95s ${EASE_CSS} forwards`, animationDelay: `${i * 0.14}s` }}
                    />
                  ))}
                </>
              )}

              {/* Círculo que se llena en hover (sin neón agresivo) */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full border transition-all ease-out"
                style={{
                  borderColor: isHovered || isClicked ? 'var(--color-primary-fixed)' : 'rgba(255,255,255,0.18)',
                  backgroundColor: isClicked ? 'transparent' : isHovered ? 'var(--color-primary-fixed)' : 'transparent',
                  transform: isClicked ? 'scale(2.4)' : isHovered ? 'scale(1.08)' : 'scale(1)',
                  opacity: isClicked ? 0 : 1,
                  transitionDuration: isClicked ? '700ms' : '500ms',
                }}
              />

              {/* Flecha */}
              <span
                className="material-symbols-outlined text-[26px] sm:text-[30px] transition-all"
                style={{
                  transitionTimingFunction: EASE_CSS,
                  transitionDuration: isClicked ? '600ms' : '500ms',
                  transform: isClicked
                    ? 'translate(90px, -90px) scale(0.5)'
                    : isHovered ? 'translate(2px, -2px)' : 'translate(0, 0)',
                  opacity: isClicked ? 0 : 1,
                  color: isHovered && !isClicked ? 'var(--color-on-primary)' : 'var(--color-primary-fixed)',
                }}
              >
                north_east
              </span>
            </div>
          </div>

          {/* Líneas laterales */}
          <div className="absolute -left-8 top-1/2 -translate-y-1/2 sm:-left-16">
            <div
              className="h-px w-8 bg-white/20 transition-all duration-500 sm:w-12"
              style={{
                transform: isClicked ? 'scaleX(0) translateX(-20px)' : isHovered ? 'scaleX(1.5)' : 'scaleX(1)',
                opacity: isClicked ? 0 : isHovered ? 1 : 0.5,
              }}
            />
          </div>
          <div className="absolute -right-8 top-1/2 -translate-y-1/2 sm:-right-16">
            <div
              className="h-px w-8 bg-white/20 transition-all duration-500 sm:w-12"
              style={{
                transform: isClicked ? 'scaleX(0) translateX(20px)' : isHovered ? 'scaleX(1.5)' : 'scaleX(1)',
                opacity: isClicked ? 0 : isHovered ? 1 : 0.5,
              }}
            />
          </div>
        </div>

        <p
          className="max-w-md text-sm leading-relaxed text-[var(--color-on-surface-variant)]/60 transition-opacity duration-500"
          style={{ opacity: isClicked ? 0 : 1 }}
        >
          Arma tu plan a la medida — grupal, personal, en pareja o en familia.
        </p>
      </div>
    </section>
  )
}
