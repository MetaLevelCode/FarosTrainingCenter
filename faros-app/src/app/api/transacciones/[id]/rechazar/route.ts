// ============================================================
// POST /api/transacciones/[id]/rechazar
// Rechaza una transacción pendiente:
//   - Marca estado='rechazada' con motivo
//   - Borra el comprobante de Storage (si existe) — evita que
//     archivos huérfanos se acumulen indefinidamente
// Solo accesible por admins.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb, getAdminStorage, pathFromDownloadUrl } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'
import { notifPayload } from '@/lib/notificaciones'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'transacciones:rechazar', { max: 20, windowMs: 60_000 })
  if (limited) return limited

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const db = getAdminDb()
    const adminSnap = await db.collection('usuarios').doc(decoded.uid).get()
    if (adminSnap.data()?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo admins' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({})) as { motivo?: string }
    const motivo = (body?.motivo ?? '').trim().slice(0, 500) || 'Sin motivo especificado'

    const txRef = db.collection('transacciones').doc(id)
    const txSnap = await txRef.get()
    if (!txSnap.exists) {
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
    }
    const tx = txSnap.data()!
    if (tx.estado !== 'pendiente') {
      return NextResponse.json({ error: 'La transacción ya fue procesada' }, { status: 409 })
    }

    // 1. Marcar como rechazada
    await txRef.update({
      estado: 'rechazada',
      fecha_revision: Date.now(),
      adminQueAprobo: decoded.uid,
      motivo_rechazo: motivo,
      comprobante_url: null,
    })

    // 1b. Notificar al alumno, con el motivo.
    await db.collection('notificaciones').add(notifPayload({
      destinatarioId: tx.usuarioId,
      tipo: 'plan_rechazado',
      titulo: 'Tu plan fue rechazado',
      mensaje: motivo,
      enlace: '/dashboard/planes',
      actorId: decoded.uid,
    }))

    // 2. Borrar comprobante de Storage (best-effort, no bloquea el rechazo)
    const url = tx.comprobante_url as string | undefined
    if (url) {
      const objectPath = pathFromDownloadUrl(url)
      if (objectPath) {
        try {
          await getAdminStorage().bucket().file(objectPath).delete()
          log.info({ scope: 'transacciones', event: 'comprobante_borrado', ip, uid: decoded.uid, id, path: objectPath })
        } catch (err) {
          // Si ya no existía o el bucket es distinto, seguimos.
          log.warn({ scope: 'transacciones', event: 'comprobante_borrado_fallido', ip, id, path: objectPath, err: String(err) })
        }
      }
    }

    log.info({ scope: 'transacciones', event: 'rechazada', ip, uid: decoded.uid, id, motivo })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'transacciones', event: 'rechazar_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
