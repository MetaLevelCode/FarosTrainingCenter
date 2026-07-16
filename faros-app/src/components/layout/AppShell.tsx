'use client'

// ============================================================
// FAROS — App Shell
// Top bar + magnetic FAB nav (Stitch "magnet edition" ported).
// Wraps all authenticated views. Nav items vary by role.
// ============================================================

import { useState, useRef, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '@/contexts/AuthContext'
import { WaterBackground } from '@/components/shared/WaterBackground'
import { FarosWordmark, Spinner } from '@/components/ui'
import type { UserRole } from '@/lib/types'

interface NavItem { label: string; href: string; icon: string }

const NAV: Record<UserRole, NavItem[]> = {
  alumno: [
    { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { label: 'Planes', href: '/dashboard/planes', icon: 'fitness_center' },
    { label: 'Asistencia', href: '/dashboard/asistencia', icon: 'calendar_today' },
    { label: 'Ranking', href: '/dashboard/ranking', icon: 'leaderboard' },
    { label: 'Perfil', href: '/dashboard/perfil', icon: 'account_circle' },
  ],
  entrenador: [
    { label: 'Portal', href: '/portal', icon: 'dashboard' },
    { label: 'Mis Clases', href: '/portal/clases', icon: 'pool' },
    { label: 'Alumnos', href: '/portal/alumnos', icon: 'groups' },
    { label: 'Perfil', href: '/portal/perfil', icon: 'account_circle' },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin', icon: 'monitoring' },
    { label: 'Usuarios', href: '/admin/usuarios', icon: 'groups' },
    { label: 'Finanzas', href: '/admin/finanzas', icon: 'payments' },
    { label: 'Planes', href: '/admin/planes', icon: 'event' },
  ],
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [fabOpen, setFabOpen] = useState(false)
  const fabRef = useRef<HTMLDivElement>(null)

  const navItems = user ? NAV[user.role] : []

  // Magnetic hover for FAB — rAF-throttled, rect cached, fine pointers only.
  // (The old version called getBoundingClientRect on EVERY mousemove,
  //  forcing constant layout recalc across the app.)
  useEffect(() => {
    const btn = fabRef.current
    if (!btn) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let rect: DOMRect | null = null
    let pending = false
    let lastX = 0, lastY = 0

    const refreshRect = () => { rect = btn.getBoundingClientRect() }
    refreshRect()
    window.addEventListener('resize', refreshRect, { passive: true })
    window.addEventListener('scroll', refreshRect, { passive: true })

    const apply = () => {
      pending = false
      if (!rect) return
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dist = Math.hypot(lastX - cx, lastY - cy)
      if (dist < 100) {
        btn.style.transform = `translate(${(lastX - cx) * 0.15}px, ${(lastY - cy) * 0.15}px)`
      } else if (btn.style.transform !== '') {
        btn.style.transform = ''
      }
    }

    const onMove = (e: MouseEvent) => {
      lastX = e.clientX
      lastY = e.clientY
      if (!pending) {
        pending = true
        requestAnimationFrame(apply)
      }
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', refreshRect)
      window.removeEventListener('scroll', refreshRect)
    }
  }, [])

  return (
    <div className="min-h-dvh relative">
      <WaterBackground />

      {/* Top bar */}
      <header className="sticky top-0 z-40 h-20 px-5 md:px-10 flex items-center justify-between backdrop-blur-xl bg-[rgba(5,5,5,0.55)] border-b border-[var(--color-surface-stroke)]">
        <div className="flex items-center gap-6">
          <FarosWordmark size="sm" />
          <span className="hidden md:block w-px h-6 bg-white/10" />
          <h1 className="hidden md:block font-display text-headline-md font-extrabold text-white uppercase tracking-tighter">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => signOut()}
            className="label-caps text-[10px] text-[var(--color-on-surface-variant)] hover:text-[var(--color-danger-crimson)] transition-colors duration-200"
          >
            Salir
          </button>
          <div className="w-9 h-9 rounded-full bg-[rgba(230,255,0,0.1)] border border-[rgba(230,255,0,0.25)] flex items-center justify-center">
            <span className="font-display text-xs font-black text-[var(--color-primary-fixed)]">
              {user?.displayName?.charAt(0) ?? 'A'}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile title */}
      <div className="md:hidden px-5 pt-6">
        <h1 className="font-display text-2xl font-black text-white uppercase tracking-tighter">{title}</h1>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="relative z-10 px-5 md:px-10 py-6 max-w-[1400px] mx-auto pb-32"
        >
          {children}
        </motion.main>
      </AnimatePresence>

      {/* Magnetic FAB nav */}
      <div className="fixed bottom-8 right-8 z-[100]">
        <AnimatePresence>
          {fabOpen && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              className="absolute bottom-20 right-0 flex flex-col gap-3"
            >
              {navItems.map((item, i) => {
                const active = pathname === item.href
                return (
                  <motion.button
                    key={item.href}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                    onClick={() => { router.push(item.href); setFabOpen(false) }}
                    className="flex items-center justify-end gap-3 group"
                  >
                    <span className={`
                      px-3 py-1.5 rounded-lg label-caps text-[11px] whitespace-nowrap backdrop-blur-md border transition-colors duration-200
                      ${active
                        ? 'bg-[var(--color-primary-fixed)] text-black border-transparent'
                        : 'bg-black/80 text-white/90 border-white/5 group-hover:text-[var(--color-primary-fixed)]'}
                    `}>
                      {item.label}
                    </span>
                    <span className={`
                      w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-200
                      ${active
                        ? 'bg-[var(--color-primary-fixed)] text-black border-transparent'
                        : 'bg-white/5 text-white/70 border-white/10 group-hover:bg-[var(--color-primary-fixed)] group-hover:text-black'}
                    `}>
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    </span>
                  </motion.button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          ref={fabRef as any}
          onClick={() => setFabOpen(v => !v)}
          whileTap={{ scale: 0.94 }}
          className="w-16 h-16 rounded-full bg-[var(--color-primary-fixed)] text-black flex items-center justify-center shadow-[0_0_28px_rgba(230,255,0,0.28)]"
          style={{ transition: 'transform 350ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 300ms' }}
        >
          <span className="material-symbols-outlined text-[32px] transition-transform duration-300" style={{ transform: fabOpen ? 'rotate(90deg)' : 'none' }}>
            {fabOpen ? 'close' : 'menu'}
          </span>
        </motion.button>
      </div>
    </div>
  )
}

// Loading guard wrapper
export function GuardedShell({ authorized, loading, title, children }: {
  authorized: boolean; loading: boolean; title: string; children: ReactNode
}) {
  if (loading || !authorized) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#050505' }}>
        <Spinner size="lg" />
      </div>
    )
  }
  return <AppShell title={title}>{children}</AppShell>
}
