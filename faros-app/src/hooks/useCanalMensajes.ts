'use client'

// ============================================================
// FAROS — Hook de mensajería en tiempo real
// Se suscribe a mensajes/{canalId}/items (onSnapshot) y se
// re-suscribe cada vez que cambia canalId. `canalId = null` desactiva
// la suscripción (ej. mientras aún no se sabe a qué canal entrar).
// ============================================================

import { useEffect, useState } from 'react'
import { getFirebase } from '@/lib/firebase'
import type { Mensaje } from '@/lib/mensajes'

export function useCanalMensajes(canalId: string | null) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // Limpiar de inmediato al cambiar de canal — si no, mientras carga el
    // nuevo (getFirebase + import dinámico + primer snapshot son async) se
    // sigue viendo la conversación del canal anterior en pantalla.
    setMensajes([])
    if (!canalId) { setCargando(false); return }

    let activo = true
    let unsub: (() => void) | undefined

    setCargando(true)
    Promise.all([getFirebase(), import('firebase/firestore')]).then(([{ db }, { collection, query, orderBy, onSnapshot }]) => {
      if (!activo) return
      const q = query(collection(db, 'mensajes', canalId, 'items'), orderBy('ts', 'asc'))
      unsub = onSnapshot(q, (snap) => {
        setMensajes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Mensaje))
        setCargando(false)
      }, (err) => {
        console.error(err)
        setCargando(false)
      })
    })

    return () => { activo = false; unsub?.() }
  }, [canalId])

  return { mensajes, cargando }
}
