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

/** Solo el último mensaje de un canal — para la vista previa en la lista de chats. */
export function useUltimoMensaje(canalId: string | null) {
  const [ultimo, setUltimo] = useState<Mensaje | null>(null)

  useEffect(() => {
    setUltimo(null)
    if (!canalId) return

    let activo = true
    let unsub: (() => void) | undefined

    Promise.all([getFirebase(), import('firebase/firestore')]).then(([{ db }, { collection, query, orderBy, limit, onSnapshot }]) => {
      if (!activo) return
      const q = query(collection(db, 'mensajes', canalId, 'items'), orderBy('ts', 'desc'), limit(1))
      unsub = onSnapshot(q, (snap) => {
        setUltimo(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() }) as Mensaje)
      }, () => {})
    })

    return () => { activo = false; unsub?.() }
  }, [canalId])

  return ultimo
}
