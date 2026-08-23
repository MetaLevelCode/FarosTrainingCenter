'use client'

// ============================================================
// FAROS — Vista previa de mensajes (dashboard del alumno)
// Reemplaza al widget de chat completo que vivía embebido aquí: ahora
// la mensajería real vive en /dashboard/mensajes (pantalla completa,
// estilo WhatsApp). Esta tarjeta es solo un teaser — mismo patrón que
// la tarjeta "Mi plan".
// ============================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, Button } from '@/components/ui'
import { getClasesAlumno } from '@/lib/firestore'
import type { Clase } from '@/lib/types'

export function MensajesPreview({ alumnoId }: { alumnoId: string }) {
  const [cargando, setCargando] = useState(true)
  const [conversaciones, setConversaciones] = useState(0)

  useEffect(() => {
    if (!alumnoId) return
    getClasesAlumno(alumnoId)
      .then((clases: Clase[]) => {
        const grupos = new Set(clases.map((c) => c.nombre_clase)).size
        const profesores = new Set(clases.map((c) => c.instructor_id).filter(Boolean)).size
        setConversaciones(grupos + profesores)
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [alumnoId])

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <h3 className="label-caps text-[var(--color-on-surface-variant)]/60">Mensajes</h3>
        <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">forum</span>
      </div>
      {cargando ? (
        <p className="text-sm text-[var(--color-on-surface-variant)]/60 mb-5">Cargando…</p>
      ) : conversaciones > 0 ? (
        <p className="text-sm text-[var(--color-on-surface-variant)]/60 mb-5">
          Tienes {conversaciones} {conversaciones === 1 ? 'conversación' : 'conversaciones'}: el muro de tu grupo y el chat con tu profesor.
        </p>
      ) : (
        <p className="text-sm text-[var(--color-on-surface-variant)]/60 mb-5">
          Aún no tienes clases asignadas — cuando te inscribas vas a poder chatear con tu grupo y tu profesor.
        </p>
      )}
      <Link href="/dashboard/mensajes">
        <Button variant="outline" size="md" fullWidth>Ver mensajes</Button>
      </Link>
    </Card>
  )
}
