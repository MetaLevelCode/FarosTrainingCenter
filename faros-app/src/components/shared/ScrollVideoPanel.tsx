'use client'

// ============================================================
// FAROS — Scroll Video Panel
// A scroll-driven reveal: as the user scrolls, the vertical
// brand video rises with parallax and a scrim lifts, while
// text content slides in from the side. Performance-first:
// uses transform/opacity only (GPU-composited), video is
// muted+loop+playsInline and only plays when in view.
// ============================================================

import { useRef, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'

export function ScrollVideoPanel() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Track scroll progress across this section
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
    layoutEffect: false,
  })

  // Parallax: video moves slower than scroll (depth)
  const videoY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%'])
  // Scale: subtle zoom-out as it settles
  const videoScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.15, 1.0, 1.08])
  // Scrim opacity: darkest at edges, clearest mid-scroll
  const scrimOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 0.25, 0.85])
  // Text drift
  const textX = useTransform(scrollYProgress, [0.1, 0.5], [40, 0])
  const textOpacity = useTransform(scrollYProgress, [0.1, 0.4], [0, 1])

  // Play only when in view (battery/perf)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.2 },
    )
    io.observe(video)
    return () => io.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative rounded-3xl overflow-hidden liquid-glass"
      style={{ minHeight: '480px' }}
    >
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 items-stretch min-h-[480px]">
        {/* Video side */}
        <div className="relative overflow-hidden min-h-[320px] md:min-h-full">
          <motion.div
            style={{ y: videoY, scale: videoScale }}
            className="absolute inset-0 will-change-transform"
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted loop playsInline
              poster="/media/logo-poster.jpg"
              preload="metadata"
            >
              <source src="/media/logo-vertical.mp4" type="video/mp4" />
            </video>
          </motion.div>

          {/* Scroll-reactive scrim */}
          <motion.div
            style={{ opacity: scrimOpacity }}
            className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/20 to-[#050505]/60 pointer-events-none"
          />
          {/* Side fade toward text */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#050505]/80 md:block hidden pointer-events-none" />
        </div>

        {/* Text side */}
        <motion.div
          style={{ x: textX, opacity: textOpacity }}
          className="flex flex-col justify-center p-8 md:p-12 will-change-transform"
        >
          <p className="label-caps text-[var(--color-primary-fixed)] mb-4 tracking-[0.2em]">
            La marca en movimiento
          </p>
          <h3 className="font-display text-headline-lg font-black text-white uppercase tracking-tighter leading-none mb-5">
            Cada brazada<br />es un faro
          </h3>
          <p className="text-[var(--color-on-surface-variant)] leading-relaxed mb-8 max-w-sm">
            El faro guía en la oscuridad. Tú eres tu propia luz en el agua:
            constante, medido, imparable. Faros ilumina tu progreso.
          </p>
          <div className="flex gap-8">
            {[
              { value: '32s', label: 'Mejor 50m' },
              { value: '94%', label: 'Consistencia' },
              { value: '18', label: 'Sesiones' },
            ].map((s) => (
              <div key={s.label}>
                <p className="font-display text-headline-md font-black text-[var(--color-primary-fixed)] leading-none">
                  {s.value}
                </p>
                <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mt-1">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
