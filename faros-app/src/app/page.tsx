'use client'

// ============================================================
// FAROS — Landing (showcase)
// Ported from Stitch "showcase_refined_typography_edition".
// Public marketing page: hero + info bento + planes + media +
// acceso por rol. Authenticated PWA users skip straight to
// their role home when launched in standalone mode.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '@/contexts/AuthContext'
import { FarosWordmark } from '@/components/ui'
import { WaterBackground } from '@/components/shared/WaterBackground'

const EASE = [0.23, 1, 0.32, 1] as const

const ROLE_HOME: Record<string, string> = {
  alumno: '/dashboard',
  entrenador: '/portal',
  admin: '/admin',
}

// ── Scroll reveal wrapper ──
function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Hero background: animated drawn paths (from Stitch SVG) ──
function BackgroundPaths() {
  const paths = [
    { d: 'M -100,500 C 200,200 400,800 1100,500', w: 2, o: 0.3, delay: '' },
    { d: 'M -100,300 C 300,100 600,900 1100,300', w: 1.5, o: 0.2, delay: 'path-anim-delay-1' },
    { d: 'M -100,700 C 400,900 500,100 1100,700', w: 3, o: 0.4, delay: 'path-anim-delay-2' },
    { d: 'M -100,400 C 250,700 750,300 1100,600', w: 1, o: 0.2, delay: 'path-anim-delay-3' },
    { d: 'M 500,-100 C 200,200 800,800 500,1100', w: 4, o: 0.1, delay: '' },
    { d: 'M -100,800 C 300,600 700,950 1100,850', w: 2, o: 0.3, delay: 'path-anim-delay-1' },
    { d: 'M 800,-100 C 600,400 900,600 700,1100', w: 2.5, o: 0.4, delay: 'path-anim-delay-3' },
    { d: 'M -100,100 C 400,500 600,0 1100,200', w: 1.2, o: 0.25, delay: '' },
    { d: 'M 100,-100 C 300,400 700,200 900,1100', w: 2, o: 0.35, delay: 'path-anim-delay-2' },
    { d: 'M -100,450 C 300,350 700,550 1100,450', w: 1, o: 0.2, delay: '' },
  ]
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40 mix-blend-screen" aria-hidden="true">
      <svg className="w-full h-full max-w-[1400px]" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
        {paths.map((p, i) => (
          <path
            key={i}
            className={`path-anim ${p.delay}`}
            d={p.d}
            fill="none"
            stroke="#e6ff00"
            strokeOpacity={p.o}
            strokeWidth={p.w}
          />
        ))}
      </svg>
    </div>
  )
}

// ── Section anchors for nav highlighting ──
const SECTIONS = ['hero', 'info', 'planes', 'media', 'auth'] as const
type SectionId = (typeof SECTIONS)[number]

function useActiveSection(): SectionId {
  const [active, setActive] = useState<SectionId>('hero')
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id as SectionId)
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])
  return active
}

// ── Pricing data ──
const PLANES = [
  {
    id: 'base',
    name: 'Base',
    monthly: 29,
    yearly: 23,
    featured: false,
    features: ['Acceso a rutinas estándar', 'Registro de asistencia', 'Comunidad de atletas'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 59,
    yearly: 47,
    featured: true,
    features: ['Todo lo del plan Base', 'Analíticas avanzadas', 'Comunicación directa con coach'],
  },
  {
    id: 'elite',
    name: 'Elite',
    monthly: 99,
    yearly: 79,
    featured: false,
    features: ['Planificación personalizada', 'Revisión de video semanal', 'Nutrición deportiva'],
  },
]

const ROLES = [
  { icon: 'directions_run', label: 'Atleta' },
  { icon: 'sports', label: 'Entrenador' },
  { icon: 'admin_panel_settings', label: 'Administrativo' },
]

const DOCK = [
  { id: 'hero' as SectionId, icon: 'home', label: 'Inicio' },
  { id: 'info' as SectionId, icon: 'info', label: 'Info' },
  { id: 'planes' as SectionId, icon: 'fitness_center', label: 'Planes' },
  { id: 'auth' as SectionId, icon: 'login', label: 'Acceso' },
]

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const active = useActiveSection()
  const homeHref = user ? ROLE_HOME[user.role] ?? '/dashboard' : '/login'

  // PWA launch: an installed, authenticated user goes straight to work.
  const redirected = useRef(false)
  useEffect(() => {
    if (loading || !user || redirected.current) return
    if (window.matchMedia('(display-mode: standalone)').matches) {
      redirected.current = true
      router.replace(ROLE_HOME[user.role] ?? '/dashboard')
    }
  }, [user, loading, router])

  const navLinks = useMemo(
    () => [
      { href: '#hero', id: 'hero' as SectionId, label: 'Inicio' },
      { href: '#info', id: 'info' as SectionId, label: 'Info' },
      { href: '#planes', id: 'planes' as SectionId, label: 'Planes' },
      { href: '#media', id: 'media' as SectionId, label: 'Media' },
    ],
    [],
  )

  return (
    <div className="relative min-h-dvh">
      <WaterBackground />

      {/* ── Top navigation (desktop) ── */}
      <header className="fixed top-0 w-full z-50 hidden md:block">
        <div className="backdrop-blur-xl bg-[rgba(5,5,5,0.55)] border-b border-[var(--color-surface-stroke)]">
          <div className="flex justify-between items-center px-10 h-20 max-w-[1400px] mx-auto">
            <Link href="#hero" aria-label="Faros Training — inicio">
              <FarosWordmark />
            </Link>
            <nav className="flex gap-8" aria-label="Secciones">
              {navLinks.map((l) => (
                <a
                  key={l.id}
                  href={l.href}
                  className={`label-caps text-[11px] pb-1 border-b-2 transition-colors duration-200 ${
                    active === l.id
                      ? 'text-white border-[var(--color-primary-fixed)]'
                      : 'text-[var(--color-secondary)] border-transparent hover:text-white'
                  }`}
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="flex gap-3">
              {user ? (
                <Link
                  href={homeHref}
                  className="label-caps text-[11px] px-6 py-3 bg-[var(--color-primary-fixed)] text-black rounded-xl font-black hover:shadow-[0_0_25px_rgba(230,255,0,0.5)] active:scale-[0.97] transition-[box-shadow,transform] duration-300"
                >
                  Mi Panel
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="label-caps text-[11px] px-6 py-3 border-2 border-[var(--color-primary-fixed)] text-[var(--color-primary-fixed)] rounded-xl hover:bg-[rgba(230,255,0,0.08)] active:scale-[0.97] transition-[background-color,transform] duration-300"
                  >
                    Iniciar Sesión
                  </Link>
                  <Link
                    href="/login"
                    className="label-caps text-[11px] px-6 py-3 bg-[var(--color-primary-fixed)] text-black rounded-xl font-black hover:shadow-[0_0_25px_rgba(230,255,0,0.5)] active:scale-[0.97] transition-[box-shadow,transform] duration-300"
                  >
                    Comenzar
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Liquid dock (mobile) ── */}
      <nav
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 md:hidden w-[90%] max-w-sm rounded-full px-8 py-4 flex justify-between items-center backdrop-blur-xl bg-[rgba(15,15,15,0.7)] border border-[rgba(230,255,0,0.15)] shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
        aria-label="Navegación"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        {DOCK.map((item) => {
          const isActive = active === item.id || (item.id === 'auth' && active === 'media')
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-label={item.label}
              className={`relative flex flex-col items-center justify-center w-11 h-11 transition-colors duration-200 ${
                isActive ? 'text-[var(--color-primary-fixed)]' : 'text-[var(--color-secondary)]'
              }`}
            >
              <span className={`material-symbols-outlined ${isActive ? 'icon-fill' : ''}`}>{item.icon}</span>
              <span
                className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[var(--color-primary-fixed)] shadow-[0_0_8px_#e6ff00] transition-[transform,opacity] duration-300 ${
                  isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                }`}
              />
            </a>
          )
        })}
      </nav>

      <main className="relative z-10">
        {/* ══ HERO ══ */}
        <section id="hero" className="relative min-h-dvh flex items-center justify-center overflow-hidden px-5 md:px-10 pt-24 pb-28 md:pb-16">
          <div className="absolute inset-0 z-0" aria-hidden="true">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(230,255,0,0.07),_transparent_60%)]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(800px,90vw)] h-[min(800px,90vw)] bg-[rgba(230,255,0,0.05)] organic-curve blur-3xl" />
            <BackgroundPaths />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="relative z-10 text-center max-w-3xl mx-auto flex flex-col items-center gap-8"
          >
            <p className="label-caps text-[var(--color-primary-fixed)] tracking-[0.3em]">
              Fitness acuático multipropósito
            </p>
            <h1 className="font-display font-black uppercase text-white leading-[1.05] tracking-tighter text-[clamp(2.5rem,8vw,4.5rem)]">
              Rendimiento{' '}
              <span className="text-[var(--color-primary-fixed)] drop-shadow-[0_0_15px_rgba(230,255,0,0.4)]">
                Elite
              </span>
            </h1>
            <p className="text-[var(--color-secondary)] text-lg max-w-xl leading-relaxed">
              Plataforma integral para el desarrollo físico en el agua. Domina tu
              disciplina con precisión milimétrica y datos en tiempo real.
            </p>
            <Link
              href={homeHref}
              className="mt-2 label-caps text-[12px] bg-[var(--color-primary-fixed)] text-black font-black px-10 py-5 rounded-2xl hover:shadow-[0_0_35px_rgba(230,255,0,0.5)] active:scale-[0.97] transition-[box-shadow,transform] duration-300"
            >
              Comenzar Ahora
            </Link>
          </motion.div>
        </section>

        {/* ══ INFO — bento grid ══ */}
        <section id="info" className="py-24 px-5 md:px-10 max-w-[1400px] mx-auto relative">
          <div className="absolute -left-32 top-0 w-96 h-96 bg-[rgba(230,255,0,0.05)] organic-curve blur-3xl pointer-events-none" aria-hidden="true" />
          <Reveal className="relative z-10 mb-14">
            <h2 className="font-display text-headline-lg font-black text-white uppercase border-l-4 border-[var(--color-primary-fixed)] pl-5 tracking-tight">
              Información
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            <Reveal className="md:col-span-2">
              <div className="liquid-glass rounded-3xl p-8 md:p-10 h-full">
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-3xl">flag</span>
                    <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">Nuestra Misión</h3>
                  </div>
                  <p className="text-[var(--color-secondary)] leading-relaxed">
                    En Faros Training nos dedicamos a forjar atletas inquebrantables.
                    Proveemos las herramientas, la analítica y el entorno necesario para
                    que tanto deportistas amateurs como profesionales alcancen su máximo
                    potencial biológico y técnico. No creemos en atajos: creemos en el
                    trabajo métrico y disciplinado.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="liquid-glass rounded-3xl p-8 md:p-10 h-full flex flex-col justify-center items-center text-center">
                <div className="relative z-10">
                  <span className="block font-display text-[56px] font-black text-[var(--color-primary-fixed)] leading-none mb-3 drop-shadow-[0_0_15px_rgba(230,255,0,0.3)]">
                    +500
                  </span>
                  <span className="label-caps text-[var(--color-secondary)]">Atletas Activos</span>
                </div>
              </div>
            </Reveal>

            {[
              { icon: 'monitoring', title: 'Análisis de Datos', body: 'Métricas en tiempo real para ajustar tu rendimiento sesión a sesión.' },
              { icon: 'calendar_month', title: 'Planificación', body: 'Rutinas periodizadas y adaptables a tu calendario competitivo.' },
              { icon: 'group', title: 'Comunidad', body: 'Conecta con entrenadores de élite y compañeros de entrenamiento.' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={0.06 * (i + 1)}>
                <div className="liquid-glass rounded-3xl p-8 h-full">
                  <div className="relative z-10">
                    <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-3xl mb-4">{f.icon}</span>
                    <h4 className="label-caps text-white mb-3">{f.title}</h4>
                    <p className="text-sm text-[var(--color-secondary)] leading-relaxed">{f.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ══ PLANES ══ */}
        <section id="planes" className="py-24 px-5 md:px-10 max-w-[1400px] mx-auto relative overflow-hidden rounded-[2.5rem] border border-[var(--color-surface-stroke)] bg-[rgba(10,10,10,0.5)] backdrop-blur-2xl my-8">
          <div className="absolute -right-32 -top-32 w-[500px] h-[500px] bg-[rgba(230,255,0,0.08)] organic-curve blur-[100px] pointer-events-none" aria-hidden="true" />
          <div className="absolute -left-32 -bottom-32 w-[400px] h-[400px] bg-[rgba(59,130,246,0.08)] organic-curve blur-[100px] pointer-events-none" aria-hidden="true" />

          <Reveal className="relative z-10 mb-14 text-center flex flex-col items-center">
            <h2 className="font-display text-headline-lg font-black text-white uppercase tracking-tight">
              Planes de{' '}
              <span className="text-[var(--color-primary-fixed)] drop-shadow-[0_0_15px_rgba(230,255,0,0.3)]">
                Entrenamiento
              </span>
            </h2>
            <p className="text-[var(--color-secondary)] mt-4 max-w-2xl mx-auto mb-10">
              Selecciona la intensidad que requiere tu objetivo actual.
            </p>

            {/* Billing toggle */}
            <div
              role="group"
              aria-label="Frecuencia de facturación"
              className="flex items-center gap-1 bg-[rgba(30,30,30,0.8)] p-1.5 rounded-full border border-[var(--color-surface-stroke)] backdrop-blur-md"
            >
              {(['monthly', 'yearly'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setBilling(mode)}
                  aria-pressed={billing === mode}
                  className={`relative px-7 py-3 rounded-full label-caps text-[10px] transition-colors duration-300 active:scale-[0.97] ${
                    billing === mode ? 'text-black' : 'text-[var(--color-secondary)] hover:text-white'
                  }`}
                >
                  {billing === mode && (
                    <motion.span
                      layoutId="billing-pill"
                      className="absolute inset-0 rounded-full bg-[var(--color-primary-fixed)] shadow-[0_0_15px_rgba(230,255,0,0.3)]"
                      transition={{ duration: 0.35, ease: EASE }}
                    />
                  )}
                  <span className="relative z-10">
                    {mode === 'monthly' ? 'Mensual' : 'Anual'}
                    {mode === 'yearly' && (
                      <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-full border ${
                        billing === 'yearly'
                          ? 'border-black/30 text-black/70'
                          : 'border-[rgba(230,255,0,0.3)] text-[var(--color-primary-fixed)]'
                      }`}>
                        −20%
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 md:items-end">
            {PLANES.map((plan, i) => (
              <Reveal key={plan.id} delay={0.07 * i}>
                <div
                  className={`liquid-glass rounded-3xl p-8 md:p-10 flex flex-col ${
                    plan.featured
                      ? '!border-[var(--color-primary-fixed)] shadow-[0_0_40px_rgba(230,255,0,0.15)] relative md:-translate-y-4'
                      : ''
                  }`}
                >
                  <div className="relative z-10 flex flex-col h-full">
                    {plan.featured && (
                      <div className="absolute -top-13 left-1/2 -translate-x-1/2 bg-[var(--color-primary-fixed)] text-black label-caps text-[10px] px-5 py-2 rounded-full shadow-[0_0_20px_rgba(230,255,0,0.4)] whitespace-nowrap">
                        Recomendado
                      </div>
                    )}
                    <div className={`text-center mb-8 pb-8 border-b ${plan.featured ? 'border-[rgba(230,255,0,0.2)] pt-2' : 'border-white/10'}`}>
                      <h3 className="font-display text-headline-md font-extrabold text-white uppercase mb-3 tracking-wide">{plan.name}</h3>
                      <p className={`font-display font-black flex items-baseline justify-center ${plan.featured ? 'text-[var(--color-primary-fixed)] text-6xl drop-shadow-[0_0_15px_rgba(230,255,0,0.4)]' : 'text-white text-5xl'}`}>
                        <span className="text-xl text-[var(--color-secondary)] mr-2">$</span>
                        <span className="relative inline-flex overflow-hidden">
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                              key={billing}
                              initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                              exit={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
                              transition={{ duration: 0.28, ease: EASE }}
                            >
                              {billing === 'monthly' ? plan.monthly : plan.yearly}
                            </motion.span>
                          </AnimatePresence>
                        </span>
                        <span className="text-sm text-[var(--color-secondary)] font-body font-normal ml-2">/mes</span>
                      </p>
                      <p className={`text-xs text-[var(--color-secondary)] mt-2 transition-opacity duration-300 ${billing === 'yearly' ? 'opacity-100' : 'opacity-0'}`}>
                        Facturado anualmente
                      </p>
                    </div>
                    <ul className="flex-grow space-y-4 mb-10">
                      {plan.features.map((feat) => (
                        <li key={feat} className={`flex items-center gap-4 ${plan.featured ? 'text-white' : 'text-[var(--color-secondary)]'}`}>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            plan.featured
                              ? 'bg-[var(--color-primary-fixed)] shadow-[0_0_10px_rgba(230,255,0,0.4)]'
                              : 'bg-[rgba(230,255,0,0.1)] border border-[rgba(230,255,0,0.3)]'
                          }`}>
                            <span className={`material-symbols-outlined text-[13px] ${plan.featured ? 'text-black' : 'text-[var(--color-primary-fixed)]'}`}>check</span>
                          </span>
                          <span className="text-sm">{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/login"
                      className={`w-full py-4 text-center label-caps text-[11px] rounded-2xl active:scale-[0.98] transition-[background-color,color,box-shadow,transform] duration-300 ${
                        plan.featured
                          ? 'bg-[var(--color-primary-fixed)] text-black font-black hover:shadow-[0_0_30px_rgba(230,255,0,0.6)]'
                          : 'border border-[rgba(230,255,0,0.5)] text-[var(--color-primary-fixed)] hover:bg-[var(--color-primary-fixed)] hover:text-black'
                      }`}
                    >
                      Elegir {plan.name}
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ══ MEDIA — asymmetric grid ══ */}
        <section id="media" className="py-24 px-5 md:px-10 max-w-[1400px] mx-auto">
          <Reveal className="mb-12 flex justify-between items-end">
            <h2 className="font-display text-headline-lg font-black text-white uppercase border-l-4 border-[var(--color-primary-fixed)] pl-5 tracking-tight">
              Últimas<br />Publicaciones
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 md:h-[600px]">
            <Reveal className="md:col-span-2 md:row-span-2">
              <div className="relative group overflow-hidden rounded-[2rem] min-h-[300px] h-full shadow-2xl">
                <Image
                  src="/media/brand-mark-1.jpg"
                  alt="Atleta de Faros Training en entrenamiento de alto rendimiento"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
                <div className="absolute bottom-0 left-0 p-8 w-full">
                  <span className="inline-block label-caps text-[10px] text-[var(--color-primary-fixed)] bg-[rgba(230,255,0,0.15)] backdrop-blur-md border border-[rgba(230,255,0,0.3)] px-3 py-1.5 rounded-full mb-4">
                    Técnica
                  </span>
                  <h3 className="font-display text-headline-md font-extrabold text-white tracking-tight">
                    Perfeccionando la técnica de brazada
                  </h3>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08} className="md:col-span-2">
              <div className="relative group overflow-hidden rounded-[2rem] min-h-[200px] h-full shadow-2xl">
                <Image
                  src="/media/hero-poster.jpg"
                  alt="Datos de rendimiento en tiempo real"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                  <h3 className="font-display text-lg font-extrabold text-white tracking-tight">Métricas que importan</h3>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.14} className="md:col-span-1">
              <div className="liquid-glass relative overflow-hidden rounded-[2rem] p-8 flex flex-col justify-center min-h-[160px] h-full cursor-pointer group">
                <div className="relative z-10">
                  <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-5xl mb-5 drop-shadow-[0_0_10px_rgba(230,255,0,0.5)] transition-transform duration-300 group-hover:scale-110">
                    play_circle
                  </span>
                  <h4 className="label-caps text-white mb-2">Video Reciente</h4>
                  <p className="text-sm text-[var(--color-secondary)]">Resumen de la competencia regional.</p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.2} className="md:col-span-1">
              <div className="relative group overflow-hidden rounded-[2rem] min-h-[160px] h-full shadow-2xl">
                <Image
                  src="/media/brand-mark-2.jpg"
                  alt="Nutrición deportiva para atletas acuáticos"
                  fill
                  sizes="(max-width: 768px) 100vw, 25vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                  <span className="label-caps text-[10px] text-[var(--color-primary-fixed)] drop-shadow-[0_0_5px_rgba(230,255,0,0.5)]">
                    Nutrición
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══ AUTH — acceso por rol ══ */}
        <section id="auth" className="py-24 px-5 md:px-10 max-w-4xl mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,90vw)] h-[min(600px,90vw)] bg-[rgba(230,255,0,0.05)] organic-curve blur-[120px] pointer-events-none" aria-hidden="true" />
          <Reveal>
            <div className="liquid-glass rounded-[2.5rem] p-8 md:p-16 relative z-10 text-center">
              <div className="relative z-10">
                <h2 className="font-display text-headline-lg font-black text-white uppercase mb-3 tracking-tight">
                  Acceso a la{' '}
                  <span className="text-[var(--color-primary-fixed)] drop-shadow-[0_0_15px_rgba(230,255,0,0.3)]">
                    Plataforma
                  </span>
                </h2>
                <p className="text-[var(--color-secondary)] mb-12">
                  Selecciona tu perfil para iniciar sesión o registrarte.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {ROLES.map((role) => (
                    <Link
                      key={role.label}
                      href="/login"
                      className="group bg-[rgba(30,30,30,0.4)] backdrop-blur-md border border-[var(--color-surface-stroke)] hover:border-[rgba(230,255,0,0.5)] p-8 rounded-[2rem] flex flex-col items-center gap-5 hover:-translate-y-1.5 active:scale-[0.98] transition-[border-color,transform,box-shadow] duration-300 hover:shadow-[0_15px_30px_rgba(0,0,0,0.4)]"
                    >
                      <span className="w-20 h-20 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-[var(--color-primary-fixed)] transition-colors duration-300 shadow-inner">
                        <span className="material-symbols-outlined text-[var(--color-secondary)] group-hover:text-black text-4xl transition-colors duration-300">
                          {role.icon}
                        </span>
                      </span>
                      <span className="label-caps text-white">{role.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ══ FOOTER ══ */}
      <footer className="relative z-10 bg-black/60 backdrop-blur-xl border-t border-[var(--color-surface-stroke)] py-12 pb-32 md:pb-12 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center px-5 md:px-10 max-w-[1400px] mx-auto gap-8">
          <FarosWordmark size="sm" />
          <div className="flex gap-6">
            <a href="mailto:contacto@farostraining.com" aria-label="Correo" className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-fixed)] transition-colors duration-200">
              <span className="material-symbols-outlined">mail</span>
            </a>
            <a href="#hero" aria-label="Volver arriba" className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-fixed)] transition-colors duration-200">
              <span className="material-symbols-outlined">arrow_upward</span>
            </a>
          </div>
          <p className="text-[var(--color-on-surface-variant)] text-xs text-center md:text-right">
            © {new Date().getFullYear()} Faros Training. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
