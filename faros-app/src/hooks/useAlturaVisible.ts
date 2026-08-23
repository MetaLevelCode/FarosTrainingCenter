'use client'

import { useEffect, useState } from 'react'

/**
 * Alto real del viewport VISIBLE (window.visualViewport.height), que se
 * achica cuando aparece el teclado en iOS/Android — a diferencia de
 * 100dvh, que en modo PWA (standalone) de iOS no siempre reacciona al
 * teclado incluso con `interactive-widget=resizes-content` declarado.
 * Fallback a window.innerHeight en navegadores sin visualViewport.
 */
export function useAlturaVisible(): number | null {
  const [alto, setAlto] = useState<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    function actualizar() {
      setAlto(vv ? vv.height : window.innerHeight)
    }
    actualizar()
    vv?.addEventListener('resize', actualizar)
    vv?.addEventListener('scroll', actualizar)
    window.addEventListener('resize', actualizar)
    return () => {
      vv?.removeEventListener('resize', actualizar)
      vv?.removeEventListener('scroll', actualizar)
      window.removeEventListener('resize', actualizar)
    }
  }, [])

  return alto
}
