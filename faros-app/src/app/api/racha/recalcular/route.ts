// ============================================================
// POST /api/racha/recalcular
// Recalcula y persiste la racha semanal de UN alumno (ver
// lib/racha-server.ts). Se llama justo después de marcar asistencia
// (lib/firestore.ts → registrarAsistencia) para que el valor cacheado
// en usuarios/{uid}.estadisticas.racha nunca quede desactualizado por
// un evento positivo — el caso de que se rompa por INACCIÓN lo cubre
// el recálculo perezoso de GET /api/ranking.
// Body: { usuarioId }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'
import { recalcularYGuardarRacha } from '@/lib/racha-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'racha:recalcular', { max: 60, windowMs: 60_000 })
  if (limited) {
    log.warn({ scope: 'racha', event: 'rate_limited', ip })
    return limited
  }

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const uid = decoded.uid
    const db = getAdminDb()

    const body = await req.json().catch(() => null) as { usuarioId?: string } | null
    const usuarioId = body?.usuarioId
    if (!usuarioId) return NextResponse.json({ error: 'Falta usuarioId' }, { status: 400 })

    // Un alumno solo puede refrescar su propia racha; profesor/admin
    // pueden refrescar la de cualquiera (es quien marca asistencia/acepta
    // cancelaciones de sus alumnos).
    if (usuarioId !== uid) {
      const requester = (await db.collection('usuarios').doc(uid).get()).data()
      if (requester?.rol !== 'admin' && requester?.rol !== 'profesor') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
    }

    const racha = await recalcularYGuardarRacha(db, usuarioId)
    return NextResponse.json({ ok: true, racha })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'racha', event: 'recalcular_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
