'use client'

// ============================================================
// FAROS — PWA Install Prompt
// Android/Chrome: captura `beforeinstallprompt` y ofrece el prompt
// nativo. iOS Safari NUNCA dispara ese evento (Apple no lo soporta) —
// ahí no hay forma programática de instalar, así que se muestran
// instrucciones manuales (Compartir → Agregar a inicio).
// A propósito NO persiste el descarte — mientras la app no esté
// instalada, vuelve a aparecer en cada entrada (decisión de producto:
// se prefiere insistir sobre no molestar).
// ============================================================

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function esStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true
}

// iPhone/iPod, o iPad (en iPadOS 13+ el user agent se reporta como Mac
// de escritorio — se distingue por soportar touch).
function esIOS(): boolean {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visibleAndroid, setVisibleAndroid] = useState(false)
  const [visibleAndroidManual, setVisibleAndroidManual] = useState(false)
  const [visibleIOS, setVisibleIOS] = useState(false)

  useEffect(() => {
    if (esStandalone()) return

    if (esIOS()) {
      const t = setTimeout(() => setVisibleIOS(true), 4000)
      return () => clearTimeout(t)
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      // Delay so it never competes with first paint / first interaction.
      setTimeout(() => setVisibleAndroid(true), 4000)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function install() {
    if (!deferred) return
    setVisibleAndroid(false)
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'dismissed') setVisibleAndroidManual(true)
    } catch {
      // El navegador rechazó o invalidó el prompt nativo (evento ya usado,
      // criterios de instalabilidad cambiaron, etc.) — igual damos una salida.
      setVisibleAndroidManual(true)
    } finally {
      setDeferred(null)
    }
  }

  // Solo oculta el sheet de ESTA visita — sin persistencia, vuelve a
  // aparecer la próxima vez que entre si la app sigue sin instalar.
  function dismissAndroid() {
    setVisibleAndroid(false)
  }

  function dismissAndroidManual() {
    setVisibleAndroidManual(false)
  }

  function dismissIOS() {
    setVisibleIOS(false)
  }

  return (
    <AnimatePresence>
      {visibleAndroid && deferred && (
        <motion.div
          key="android"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2.5rem)] max-w-sm"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0)' }}
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
                onClick={dismissAndroid}
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

      {visibleAndroidManual && (
        <motion.div
          key="android-manual"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2.5rem)] max-w-sm"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0)' }}
          role="dialog"
          aria-label="Instalar aplicación"
        >
          <div className="liquid-glass rounded-2xl p-4 !bg-[rgba(10,10,10,0.85)]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[rgba(230,255,0,0.12)] border border-[rgba(230,255,0,0.25)] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-[22px]">install_mobile</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">Puedes instalar Faros cuando quieras</p>
                <p className="text-[11px] text-[var(--color-on-surface-variant)] leading-snug mt-1.5">
                  Toca el menú (<span className="material-symbols-outlined text-[13px] align-text-bottom text-white mx-0.5">more_vert</span>) arriba a la derecha del navegador y selecciona <span className="font-bold text-white">&ldquo;Instalar app&rdquo;</span> o <span className="font-bold text-white">&ldquo;Añadir a pantalla de inicio&rdquo;</span>.
                </p>
              </div>
              <button
                onClick={dismissAndroidManual}
                aria-label="Descartar"
                className="w-9 h-9 rounded-xl text-[var(--color-on-surface-variant)]/60 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors duration-200 shrink-0 -mt-1 -mr-1"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {visibleIOS && (
        <motion.div
          key="ios"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2.5rem)] max-w-sm"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0)' }}
          role="dialog"
          aria-label="Instalar aplicación"
        >
          <div className="liquid-glass rounded-2xl p-4 !bg-[rgba(10,10,10,0.85)]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[rgba(230,255,0,0.12)] border border-[rgba(230,255,0,0.25)] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-[22px]">install_mobile</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">Instala Faros en tu iPhone</p>
                <p className="text-[11px] text-[var(--color-on-surface-variant)] leading-snug mt-1.5">
                  Toca el botón Compartir (<span className="material-symbols-outlined text-[13px] align-text-bottom text-white mx-0.5">ios_share</span>) en la barra inferior, desliza hacia abajo y selecciona <span className="font-bold text-white">&ldquo;Agregar a inicio&rdquo;</span>.
                </p>
              </div>
              <button
                onClick={dismissIOS}
                aria-label="Descartar"
                className="w-9 h-9 rounded-xl text-[var(--color-on-surface-variant)]/60 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors duration-200 shrink-0 -mt-1 -mr-1"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
