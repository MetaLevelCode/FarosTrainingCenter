'use client'
import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Dev: a leftover SW serving cached chunks causes hydration
    // mismatches (stale client JS vs fresh server HTML). Actively
    // unregister and purge so dev browsers self-heal.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {})
      if ('caches' in window) {
        caches.keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {})
      }
      return
    }

    let reg: ServiceWorkerRegistration | undefined

    navigator.serviceWorker
      .register('/sw.js')
      .then((r) => {
        reg = r
        // A new SW took control → reload once so the fresh assets apply.
        let refreshed = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshed) return
          refreshed = true
          window.location.reload()
        })
      })
      .catch(() => {})

    // Check for updates when the app returns to the foreground.
    const onVisible = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  return null
}
