'use client'

// ============================================================
// FAROS — Campanita de notificaciones
// Vive en AppShell, page-independiente (igual que PendienteSync):
// escucha en vivo lo que afecta a este usuario — plan aprobado/
// rechazado, comprobante subido (solo admins), clase personalizada
// solicitada/aceptada/rechazada/cancelada. Ver firestore.rules y
// lib/notificaciones.ts para el resto del flujo.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '@/contexts/AuthContext'
import { getFirebase } from '@/lib/firebase'
import { cuando } from '@/lib/mensajes'
import type { Notificacion } from '@/lib/types'

const EASE = [0.23, 1, 0.32, 1] as const

export function NotificationBell() {
  const { user } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<Notificacion[]>([])
  const [abierto, setAbierto] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user?.uid) return
    let unsub = () => {}
    let cancelado = false
    ;(async () => {
      try {
        const [{ db }, { collection, query, where, orderBy, limit, onSnapshot }] = await Promise.all([
          getFirebase(), import('firebase/firestore'),
        ])
        if (cancelado) return
        const q = user.rol === 'admin'
          ? query(collection(db, 'notificaciones'), where('paraRol', '==', 'admin'), orderBy('creadoEn', 'desc'), limit(30))
          : query(collection(db, 'notificaciones'), where('destinatarioId', '==', user.uid), orderBy('creadoEn', 'desc'), limit(30))
        unsub = onSnapshot(q, (snap) => {
          setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notificacion)))
        }, (err) => console.error(err))
      } catch (err) {
        console.error(err)
      }
    })()
    return () => { cancelado = true; unsub() }
  }, [user?.uid, user?.rol])

  // Cerrar al tocar fuera del panel.
  useEffect(() => {
    if (!abierto) return
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [abierto])

  async function marcarLeida(id: string) {
    try {
      const [{ db }, { doc, updateDoc }] = await Promise.all([
        getFirebase(), import('firebase/firestore'),
      ])
      await updateDoc(doc(db, 'notificaciones', id), { leida: true })
    } catch (err) {
      console.error(err)
    }
  }

  function abrir(n: Notificacion) {
    setAbierto(false)
    if (!n.leida && n.id) marcarLeida(n.id)
    if (n.enlace) router.push(n.enlace)
  }

  const noLeidas = items.filter((n) => !n.leida).length

  if (!user) return null

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="relative label-caps text-[10px] min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--color-on-surface-variant)] hover:text-white hover:bg-white/5 active:scale-[0.96] transition-[color,background-color,transform] duration-200"
        aria-label="Notificaciones"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {noLeidas > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--color-primary-fixed)] text-black text-[9px] font-bold flex items-center justify-center">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute right-0 top-[calc(100%+8px)] w-[340px] max-h-[70vh] overflow-y-auto rounded-2xl backdrop-blur-md bg-black/90 border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.5)] z-[110]"
          >
            <div className="px-4 py-3 border-b border-white/10">
              <h2 className="label-caps text-[10px] text-white">Notificaciones</h2>
            </div>

            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-[var(--color-on-surface-variant)]">
                No tienes notificaciones.
              </p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => abrir(n)}
                      className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors duration-150 ${!n.leida ? 'bg-[rgba(230,255,0,0.04)]' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.leida && (
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-primary-fixed)] flex-shrink-0" />
                        )}
                        <div className={n.leida ? 'pl-3.5' : ''}>
                          <p className="text-xs font-semibold text-white">{n.titulo}</p>
                          <p className="text-[11px] text-[var(--color-on-surface-variant)] mt-0.5 leading-relaxed">{n.mensaje}</p>
                          <p className="text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1">{cuando(n.creadoEn)}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
