'use client'

// ============================================================
// FAROS — Indicador + auto-sync de la cola offline
// Se monta una sola vez (AppShell). Mientras haya asistencias
// encoladas, muestra un chip discreto; al volver `online` (o al
// montar, por si ya había conexión) intenta sincronizar solas.
// ============================================================

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { registrarAsistencia } from '@/lib/firestore'
import { cantidadPendientes, sincronizarCola } from '@/lib/offlineQueue'

export function PendienteSync() {
  const [pendientes, setPendientes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)

  async function intentarSincronizar() {
    if (cantidadPendientes() === 0) { setPendientes(0); return }
    if (!navigator.onLine) { setPendientes(cantidadPendientes()); return }
    setSincronizando(true)
    const { fallidas } = await sincronizarCola(registrarAsistencia)
    setPendientes(fallidas)
    setSincronizando(false)
  }

  useEffect(() => {
    setPendientes(cantidadPendientes())
    intentarSincronizar()
    window.addEventListener('online', intentarSincronizar)
    return () => window.removeEventListener('online', intentarSincronizar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AnimatePresence>
      {pendientes > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[150] px-4 py-2 rounded-full liquid-glass !bg-[rgba(10,10,10,0.85)] flex items-center gap-2"
          role="status"
        >
          <span className={`material-symbols-outlined text-[16px] ${sincronizando ? 'animate-spin' : ''} text-amber-400`}>
            {sincronizando ? 'sync' : 'cloud_off'}
          </span>
          <span className="label-caps text-[10px] text-white">
            {sincronizando
              ? 'Sincronizando…'
              : `${pendientes} ${pendientes === 1 ? 'asistencia pendiente' : 'asistencias pendientes'} de sincronizar`}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
