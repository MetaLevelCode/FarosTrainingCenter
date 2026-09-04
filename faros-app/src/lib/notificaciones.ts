// ============================================================
// FAROS — Notificaciones
// Constructor puro del payload (sin llamadas a Firestore): lo usan tanto
// los helpers cliente de lib/firestore.ts (addDoc/tx.set) como las rutas
// Admin SDK de /api/personalizadas y /api/transacciones (doc().set()).
// Exactamente uno de destinatarioId/paraRol va presente — nunca ambos.
// ============================================================

import type { Notificacion, TipoNotificacion } from './types'

type NotifInput =
  | {
      destinatarioId: string
      paraRol?: never
      tipo: TipoNotificacion
      titulo: string
      mensaje: string
      enlace?: string
      actorId: string
    }
  | {
      destinatarioId?: never
      paraRol: 'admin'
      tipo: TipoNotificacion
      titulo: string
      mensaje: string
      enlace?: string
      actorId: string
    }

export function notifPayload(input: NotifInput): Notificacion {
  return {
    destinatarioId: input.destinatarioId ?? null,
    paraRol: input.paraRol ?? null,
    tipo: input.tipo,
    titulo: input.titulo,
    mensaje: input.mensaje,
    enlace: input.enlace ?? null,
    actorId: input.actorId,
    leida: false,
    creadoEn: Date.now(),
  }
}
