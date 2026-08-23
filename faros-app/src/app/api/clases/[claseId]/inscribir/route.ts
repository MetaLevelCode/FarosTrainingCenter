// ============================================================
// POST /api/clases/[claseId]/inscribir
// Inscribe al estudiante en una clase de forma atómica:
//   - Valida suscripción activa + sesiones > 0
//   - Valida cupo disponible + clase programada + no inscrito ya
//   - arrayUnion uid en estudiantes_inscritos
//   - Incrementa estadisticas.clasesReservadas
//   - Descuenta 1 sesión de sesionesRestantes (se consume al reservar,
//     no al marcar asistencia — evita que el alumno sobre-reserve más
//     clases de las que su saldo permite). /cancelar la devuelve.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'
import { canalGrupo } from '@/lib/mensajes'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ claseId: string }> },
) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'clases:inscribir', { max: 20, windowMs: 60_000 })
  if (limited) {
    log.warn({ scope: 'clases', event: 'rate_limited', action: 'inscribir', ip })
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

      if (usu.rol !== 'estudiante') return { error: 'Solo estudiantes pueden inscribirse', status: 403 }
      if (usu.activo === false) return { error: 'Tu cuenta está suspendida', status: 403 }

      const susc = usu.suscripcionActiva
      if (!susc || susc.estado !== 'activa') {
        return { error: 'Necesitas una suscripción activa para inscribirte', status: 403 }
      }
      if ((susc.sesionesRestantes ?? 0) <= 0) {
        return { error: 'No tienes sesiones disponibles en tu plan actual', status: 403 }
      }

      if (usu.sede && clase.sede && usu.sede !== clase.sede) {
        return { error: 'Esta clase es de otra sede', status: 403 }
      }
      if (clase.estado !== 'programada') return { error: 'Esta clase ya no está disponible', status: 409 }
      if (clase.fecha_hora_inicio <= Date.now()) return { error: 'Esta clase ya comenzó', status: 409 }

      const inscritos: string[] = clase.estudiantes_inscritos ?? []
      if (inscritos.includes(uid)) return { error: 'Ya estás inscrito en esta clase', status: 409 }
      if (inscritos.length >= clase.cupo_maximo) {
        return { error: 'No hay cupo disponible en esta clase', status: 409 }
      }

      tx.update(claseSnap.ref, {
        estudiantes_inscritos: FieldValue.arrayUnion(uid),
        actualizadoEn: Date.now(),
      })

      // Muro de mensajería del grupo: agrega al alumno (y re-agrega al
      // instructor, idempotente) a la lista de miembros del canal. Es el
      // único lugar donde se mantiene esta lista — ver firestore.rules.
      tx.set(db.collection('mensajes').doc(canalGrupo(clase.nombre_clase)), {
        tipo: 'grupo',
        nombre: clase.nombre_clase,
        participantes: FieldValue.arrayUnion(uid, clase.instructor_id),
        actualizadoEn: Date.now(),
      }, { merge: true })

      const asistidas = (usu.estadisticas?.clasesAsistidas as number) ?? 0
      const reservadas = ((usu.estadisticas?.clasesReservadas as number) ?? 0) + 1

      // Descuenta la sesión del saldo del plan (tope en el total comprado).
      const restantesPrev: number = susc.sesionesRestantes ?? 0
      const sesionesCompradas: number | undefined = susc.sesionesCompradas
      const cap = Number.isFinite(sesionesCompradas) ? (sesionesCompradas as number) : Number.POSITIVE_INFINITY
      const restantes = Math.max(0, Math.min(cap, restantesPrev - 1))
      const nuevoEstado = restantes === 0 ? 'vencida' : 'activa'

      tx.update(usuSnap.ref, {
        'estadisticas.clasesReservadas': reservadas,
        'estadisticas.tasaAsistencia': reservadas > 0 ? Math.min(1, asistidas / reservadas) : 0,
        'suscripcionActiva.sesionesRestantes': restantes,
        'suscripcionActiva.estado': nuevoEstado,
      })

      if (susc.suscripcionId) {
        tx.update(db.collection('suscripciones').doc(susc.suscripcionId), {
          sesiones_restantes: restantes,
          estado: nuevoEstado,
        })
      }

      return { ok: true }
    })

    if ('error' in resultado) {
      log.info({ scope: 'clases', event: 'inscribir_rechazado', ip, uid, claseId, motivo: resultado.error })
      return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
    }
    log.info({ scope: 'clases', event: 'inscrito', ip, uid, claseId })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'clases', event: 'inscribir_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
