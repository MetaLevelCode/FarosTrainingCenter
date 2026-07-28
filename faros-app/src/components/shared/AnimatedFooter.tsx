'use client'

// ============================================================
// FAROS — Pie de página
// Columnas de enlaces con entrada difuminada al entrar en vista.
// Sustituye al oleaje anterior: mismo cierre visual, sin bucle de
// requestAnimationFrame ni 23 barras mutando transform por frame.
// Iconos de redes en SVG inline (sin dependencias nuevas).
// ============================================================

import type { ComponentProps, ReactNode } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { FarosLogo } from '@/components/ui'

type IconoProps = { className?: string }

const Instagram = ({ className }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)

const Facebook = ({ className }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z" />
  </svg>
)

const WhatsApp = ({ className }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1a12 12 0 0 1-5.8-5c-.4-.7-.7-1.5-.7-2.2 0-.8.4-1.4.7-1.7.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .6.4l.8 1.9c.1.2 0 .4-.1.5l-.4.5c-.1.2-.3.3-.1.6a8 8 0 0 0 3.4 3c.3.1.5.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.3v.5c0 .2 0 .4-.1.6z" />
  </svg>
)

interface Enlace { titulo: string; href: string; icono?: React.ComponentType<IconoProps> }
interface Seccion { titulo: string; enlaces: Enlace[] }

const SECCIONES: Seccion[] = [
  {
    titulo: 'Plataforma',
    enlaces: [
      { titulo: 'Arma tu plan', href: '/dashboard/planes' },
      { titulo: 'Iniciar sesión', href: '/login' },
      { titulo: 'Opiniones', href: '#opiniones' },
    ],
  },
  {
    titulo: 'El club',
    enlaces: [
      { titulo: 'Información', href: '#info' },
      { titulo: 'Publicaciones', href: '#media' },
      { titulo: 'Sedes y horarios', href: '#planes' },
    ],
  },
  {
    titulo: 'Contacto',
    enlaces: [
      { titulo: 'contacto@farostraining.com', href: 'mailto:contacto@farostraining.com' },
      { titulo: 'Pereira, Risaralda', href: '#info' },
    ],
  },
  {
    titulo: 'Síguenos',
    enlaces: [
      { titulo: 'Instagram', href: '#', icono: Instagram },
      { titulo: 'Facebook', href: '#', icono: Facebook },
      { titulo: 'WhatsApp', href: '#', icono: WhatsApp },
    ],
  },
]

export function AnimatedFooter() {
  return (
    <footer className="relative z-10 w-full mx-auto max-w-[1400px] flex flex-col items-center rounded-t-[2.5rem] border-t border-[var(--color-surface-stroke)] bg-[radial-gradient(38%_128px_at_50%_0%,rgba(230,255,0,0.07),transparent)] px-5 md:px-10 py-14 lg:py-16">
      {/* Filo luminoso superior */}
      <div className="absolute top-0 left-1/2 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-primary-fixed)]/40 blur-[1px]" />

      <div className="grid w-full gap-10 xl:grid-cols-3 xl:gap-8">
        <Entrada className="space-y-5">
          <FarosLogo size={34} />
          <p className="text-sm text-[var(--color-on-surface-variant)]/70 max-w-xs leading-relaxed">
            Entrenamiento acuático de alto rendimiento en Risaralda.
            Planes a la medida, datos reales, progreso medible.
          </p>
          <p className="text-sm text-[var(--color-on-surface-variant)]/50">
            © {new Date().getFullYear()} Faros Training. Todos los derechos reservados.
          </p>
        </Entrada>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 xl:col-span-2">
          {SECCIONES.map((sec, i) => (
            <Entrada key={sec.titulo} delay={0.1 + i * 0.1}>
              <h3 className="label-caps text-[10px] text-[var(--color-primary-fixed)]">{sec.titulo}</h3>
              <ul className="mt-4 space-y-1">
                {sec.enlaces.map((e) => (
                  <li key={e.titulo}>
                    <Link
                      href={e.href}
                      className="inline-flex items-center gap-2 min-h-[44px] text-sm text-[var(--color-on-surface-variant)]/75 hover:text-[var(--color-primary-fixed)] transition-colors duration-300"
                    >
                      {e.icono && <e.icono className="size-4 shrink-0" />}
                      {e.titulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </Entrada>
          ))}
        </div>
      </div>
    </footer>
  )
}

type EntradaProps = {
  delay?: number
  className?: ComponentProps<typeof motion.div>['className']
  children: ReactNode
}

/** Aparece con un desenfoque leve al entrar en vista (una sola vez). */
function Entrada({ className, delay = 0.1, children }: EntradaProps) {
  const reducir = useReducedMotion()

  if (reducir) return <div className={className}>{children}</div>

  return (
    <motion.div
      initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
      whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
