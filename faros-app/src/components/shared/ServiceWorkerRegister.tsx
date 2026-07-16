'use client'
import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

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
