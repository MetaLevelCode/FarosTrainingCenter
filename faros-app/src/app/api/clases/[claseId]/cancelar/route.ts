// ============================================================
// POST /api/clases/[claseId]/cancelar
// Cancela la inscripción del estudiante en una clase.
// Solo se puede cancelar hasta 2 horas antes del inicio.
// Devuelve la sesión descontada al inscribirse (tope en lo comprado).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'

export const runtime = 'nodejs'

const VENTANA_MS = 2 * 60 * 60 * 1000 // 2 horas antes del inicio

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ claseId: string }> },
) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'clases:cancelar', { max: 20, windowMs: 60_000 })
  if (limited) {
    log.warn({ scope: 'clases', event: 'rate_limited', action: 'cancelar', ip })
    return limited
  }

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const uid = decoded.uid
    const { claseId } = await params

    const db = getAdminDb()

    const resultado = await db.runTransaction(async (tx) => {
      const [claseSnap, usuSnap] = await Promise.all([
        tx.get(db.collection('clases').doc(claseId)),
        tx.get(db.collection('usuarios').doc(uid)),
      ])

      if (!claseSnap.exists) return { error: 'Clase no encontrada', status: 404 }
      if (!usuSnap.exists) return { error: 'Usuario no encontrado', status: 404 }

      const clase = claseSnap.data()!
      const usu = usuSnap.data()!

      if (usu.activo === false) return { error: 'Tu cuenta está suspendida', status: 403 }

      const inscritos: string[] = clase.estudiantes_inscritos ?? []
      if (!inscritos.includes(uid)) {
        return { error: 'No estás inscrito en esta clase', status: 409 }
      }

      if (clase.estado !== 'programada') {
        return { error: 'No se puede cancelar una clase que ya inició o finalizó', status: 409 }
      }

      const tiempoRestante = clase.fecha_hora_inicio - Date.now()
      if (tiempoRestante < VENTANA_MS) {
        return { error: 'Solo puedes cancelar hasta 2 horas antes del inicio de la clase', status: 409 }
      }

      tx.update(claseSnap.ref, {
        estudiantes_inscritos: FieldValue.arrayRemove(uid),
        actualizadoEn: Date.now(),
      })

      const asistidas = (usu.estadisticas?.clasesAsistidas as number) ?? 0
      const clasesReservadas: number = usu.estadisticas?.clasesReservadas ?? 0
      if (clasesReservadas > 0) {
        const reservadas = clasesReservadas - 1
        tx.update(usuSnap.ref, {
          'estadisticas.clasesReservadas': reservadas,
          'estadisticas.tasaAsistencia': reservadas > 0 ? Math.min(1, asistidas / reservadas) : 0,
        })
      }

      // Devuelve la sesión al saldo del plan (tope en el total comprado).
      const susc = usu.suscripcionActiva
      if (susc) {
        const restantesPrev: number = susc.sesionesRestantes ?? 0
        const sesionesCompradas: number | undefined = susc.sesionesCompradas
        const cap = Number.isFinite(sesionesCompradas) ? (sesionesCompradas as number) : Number.POSITIVE_INFINITY
        const restantes = Math.max(0, Math.min(cap, restantesPrev + 1))
        const nuevoEstado = restantes > 0 ? 'activa' : susc.estado

        tx.update(usuSnap.ref, {
          'suscripcionActiva.sesionesRestantes': restantes,
          'suscripcionActiva.estado': nuevoEstado,
        })

        if (susc.suscripcionId) {
          tx.update(db.collection('suscripciones').doc(susc.suscripcionId), {
            sesiones_restantes: restantes,
            estado: nuevoEstado,
          })
        }
      }

      return { ok: true }
    })

    if ('error' in resultado) {
      log.info({ scope: 'clases', event: 'cancelar_rechazado', ip, uid, claseId, motivo: resultado.error })
      return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
    }
    log.info({ scope: 'clases', event: 'cancelado', ip, uid, claseId })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'clases', event: 'cancelar_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
