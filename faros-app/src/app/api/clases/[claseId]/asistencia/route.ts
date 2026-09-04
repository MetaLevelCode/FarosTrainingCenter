// ============================================================
// POST /api/clases/[claseId]/asistencia
// Registra o corrige la asistencia de un alumno a una clase.
//
// Server-side porque firestore.rules no puede validar esto de forma
// confiable desde el cliente: la escritura a `asistencias` sí exige
// instructor_id == uid, pero la escritura hermana a
// `usuarios/{uid}.estadisticas` (clasesAsistidas/tasaAsistencia) se
// evalúa de forma independiente — nada ata esa escritura a que el
// profesor sea instructor de ESA clase puntual ni a que el alumno esté
// inscrito en ella. Antes, cualquier profesor podía alterar las
// estadísticas de asistencia de cualquier alumno de la plataforma.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ claseId: string }> },
) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'clases:asistencia', { max: 60, windowMs: 60_000 })
  if (limited) {
    log.warn({ scope: 'clases', event: 'rate_limited', action: 'asistencia', ip })
    return limited
  }

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const uid = decoded.uid
    const { claseId } = await params

    const body = await req.json().catch(() => null) as { usuarioId?: string; asistio?: boolean } | null
    const usuarioId = body?.usuarioId
    const asistio = body?.asistio
    if (!usuarioId || typeof asistio !== 'boolean') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const db = getAdminDb()
    const asistenciaRef = db.collection('asistencias').doc(`${claseId}_${usuarioId}`)

    const resultado = await db.runTransaction(async (tx) => {
      const [claseSnap, requesterSnap, existingSnap, usuSnap] = await Promise.all([
        tx.get(db.collection('clases').doc(claseId)),
        tx.get(db.collection('usuarios').doc(uid)),
        tx.get(asistenciaRef),
        tx.get(db.collection('usuarios').doc(usuarioId)),
      ])

      if (!claseSnap.exists) return { error: 'Clase no encontrada', status: 404 }
      const clase = claseSnap.data()!
      const esAdmin = requesterSnap.data()?.rol === 'admin'
      if (!esAdmin && clase.instructor_id !== uid) {
        return { error: 'No sos el instructor de esta clase', status: 403 }
      }

      const inscritos: string[] = clase.estudiantes_inscritos ?? []
      if (!inscritos.includes(usuarioId)) {
        return { error: 'Este alumno no está inscrito en esta clase', status: 403 }
      }
      if (!usuSnap.exists) return { error: 'Alumno no encontrado', status: 404 }

      const now = Date.now()
      const previo = existingSnap.exists ? Boolean(existingSnap.data()!.asistio) : null
      const delta = asistio === previo ? 0 : (asistio ? 1 : -1)

      if (existingSnap.exists) {
        tx.update(asistenciaRef, { asistio, fecha_registro: now })
      } else {
        tx.set(asistenciaRef, {
          asistenciaId: asistenciaRef.id,
          claseId, usuarioId, asistio,
          fecha_registro: now,
          registradoPor: uid,
          creadoEn: now,
        })
      }

      if (delta !== 0) {
        const usu = usuSnap.data()!
        const asistidasPrev = (usu.estadisticas?.clasesAsistidas as number) ?? 0
        const reservadasPrev = (usu.estadisticas?.clasesReservadas as number) ?? 0
        const asistidas = Math.max(0, asistidasPrev + delta)
        const tasaAsistencia = reservadasPrev > 0 ? Math.min(1, asistidas / reservadasPrev) : 0
        tx.update(usuSnap.ref, {
          'estadisticas.clasesAsistidas': asistidas,
          'estadisticas.tasaAsistencia': tasaAsistencia,
        })
      }

      return { ok: true as const, huboCambio: delta !== 0 }
    })

    if ('error' in resultado) {
      log.info({ scope: 'clases', event: 'asistencia_rechazada', ip, uid, claseId, usuarioId, motivo: resultado.error })
      return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
    }
    log.info({ scope: 'clases', event: 'asistencia_registrada', ip, uid, claseId, usuarioId, asistio })
    return NextResponse.json({ ok: true, huboCambio: resultado.huboCambio })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'clases', event: 'asistencia_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
