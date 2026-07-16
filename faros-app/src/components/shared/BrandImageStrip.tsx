'use client'

// ============================================================
// FAROS — Brand Image Strip
// Two brand-mark images with subtle scroll parallax, used as
// a texture break between content sections. Transform-only.
// ============================================================

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'

export function BrandImageStrip() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
    layoutEffect: false,
  })

  const y1 = useTransform(scrollYProgress, [0, 1], ['-6%', '6%'])
  const y2 = useTransform(scrollYProgress, [0, 1], ['6%', '-6%'])

  return (
    <div ref={ref} className="grid grid-cols-2 gap-4 md:gap-6">
      {[
        { src: '/media/brand-mark-1.jpg', y: y1, label: 'Precisión' },
        { src: '/media/brand-mark-2.jpg', y: y2, label: 'Dirección' },
      ].map((img, i) => (
        <div
          key={i}
          className="relative rounded-3xl overflow-hidden aspect-[3/4] liquid-glass"
        >
          <motion.img
            src={img.src}
            alt={`Faros ${img.label}`}
            style={{ y: img.y, scale: 1.12 }}
            className="absolute inset-0 w-full h-full object-cover will-change-transform"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-5 left-5 z-10">
            <p className="label-caps text-[var(--color-primary-fixed)] text-[10px]">{img.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
