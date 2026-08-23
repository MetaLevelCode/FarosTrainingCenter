// ============================================================
// POST /api/personalizadas/[id]/rechazar
// El profesor dueño de la solicitud (o un admin) la rechaza con un
// motivo obligatorio. Body: { motivo: string }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'personalizadas:rechazar', { max: 20, windowMs: 60_000 })
  if (limited) {
    log.warn({ scope: 'personalizadas', event: 'rate_limited', action: 'rechazar', ip })
    return limited
  }

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const uid = decoded.uid
    const { id } = await params
    const db = getAdminDb()

    const body = await req.json().catch(() => null) as { motivo?: string } | null
    const motivo = body?.motivo?.trim().slice(0, 500)
    if (!motivo) return NextResponse.json({ error: 'El motivo es obligatorio' }, { status: 400 })

    const resultado = await db.runTransaction(async (tx) => {
      const solRef = db.collection('solicitudes_personalizadas').doc(id)
      const [solSnap, requesterSnap] = await Promise.all([
        tx.get(solRef),
        tx.get(db.collection('usuarios').doc(uid)),
      ])

      if (!solSnap.exists) return { error: 'Solicitud no encontrada', status: 404 }
      const sol = solSnap.data()!
      if (sol.estado !== 'pendiente') return { error: 'Esta solicitud ya fue respondida', status: 409 }

      const esDueno = sol.profesorId === uid
      const esAdmin = requesterSnap.data()?.rol === 'admin'
      if (!esDueno && !esAdmin) return { error: 'No autorizado', status: 403 }

      tx.update(solRef, {
        estado: 'rechazada',
        motivoRechazo: motivo,
        respondidoEn: Date.now(),
      })
      return { ok: true as const }
    })

    if ('error' in resultado) {
      log.info({ scope: 'personalizadas', event: 'rechazar_rechazado', ip, uid, solicitudId: id, motivo: resultado.error })
      return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
    }
    log.info({ scope: 'personalizadas', event: 'rechazada', ip, uid, solicitudId: id })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'personalizadas', event: 'rechazar_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
