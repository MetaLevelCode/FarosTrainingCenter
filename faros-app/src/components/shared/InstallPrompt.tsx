'use client'

// ============================================================
// FAROS — PWA Install Prompt
// Captures `beforeinstallprompt` and surfaces a discreet chip.
// Rare, first-time interaction → subtle entrance animation is
// appropriate (Emil framework). Dismissal persists 14 days.
// ============================================================

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'faros-install-dismissed'
const DISMISS_DAYS = 14

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already installed → never show.
    if (window.matchMedia('(display-mode: standalone)').matches) return

    try {
      const dismissed = localStorage.getItem(DISMISS_KEY)
      if (dismissed && Date.now() - Number(dismissed) < DISMISS_DAYS * 86_400_000) return
    } catch {}

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      // Delay so it never competes with first paint / first interaction.
      setTimeout(() => setVisible(true), 4000)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function install() {
    if (!deferred) return
    setVisible(false)
    await deferred.prompt()
    setDeferred(null)
  }

  function dismiss() {
    setVisible(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
  }

  return (
    <AnimatePresence>
      {visible && deferred && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2.5rem)] max-w-sm"
          role="dialog"
          aria-label="Instalar aplicación"
        >
          <div className="liquid-glass rounded-2xl p-4 flex items-center gap-4 !bg-[rgba(10,10,10,0.85)]">
            <div className="w-10 h-10 rounded-xl bg-[rgba(230,255,0,0.12)] border border-[rgba(230,255,0,0.25)] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-[22px]">install_mobile</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">Instala Faros</p>
              <p className="text-[11px] text-[var(--color-on-surface-variant)] leading-snug mt-0.5">
                Acceso directo, pantalla completa y soporte offline.
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={dismiss}
                aria-label="Descartar"
                className="w-9 h-9 rounded-xl text-[var(--color-on-surface-variant)]/60 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors duration-200"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
              <button
                onClick={install}
                className="px-4 py-2.5 rounded-xl bg-[var(--color-primary-fixed)] text-black label-caps text-[10px] active:scale-[0.97] transition-transform duration-150"
              >
                Instalar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
