// ============================================================
// POST /api/personalizadas/[id]/cancelar
// El alumno dueño cancela su propia solicitud mientras esté pendiente
// (antes de que el profesor responda).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'
import { notifPayload } from '@/lib/notificaciones'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'personalizadas:cancelar', { max: 20, windowMs: 60_000 })
  if (limited) {
    log.warn({ scope: 'personalizadas', event: 'rate_limited', action: 'cancelar', ip })
    return limited
  }

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const uid = decoded.uid
    const { id } = await params
    const db = getAdminDb()

    const resultado = await db.runTransaction(async (tx) => {
      const solRef = db.collection('solicitudes_personalizadas').doc(id)
      const solSnap = await tx.get(solRef)

      if (!solSnap.exists) return { error: 'Solicitud no encontrada', status: 404 }
      const sol = solSnap.data()!
      if (sol.alumnoId !== uid) return { error: 'No autorizado', status: 403 }
      if (sol.estado !== 'pendiente') return { error: 'Esta solicitud ya fue respondida', status: 409 }

      tx.update(solRef, { estado: 'cancelada', respondidoEn: Date.now() })

      const notifRef = db.collection('notificaciones').doc()
      tx.set(notifRef, notifPayload({
        destinatarioId: sol.profesorId,
        tipo: 'clase_cancelada',
        titulo: 'Solicitud de horario cancelada',
        mensaje: `${sol.nombreAlumno ?? 'Un alumno'} canceló su solicitud pendiente.`,
        enlace: '/portal',
        actorId: uid,
      }))

      return { ok: true as const }
    })

    if ('error' in resultado) {
      log.info({ scope: 'personalizadas', event: 'cancelar_rechazado', ip, uid, solicitudId: id, motivo: resultado.error })
      return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
    }
    log.info({ scope: 'personalizadas', event: 'cancelada', ip, uid, solicitudId: id })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'personalizadas', event: 'cancelar_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
