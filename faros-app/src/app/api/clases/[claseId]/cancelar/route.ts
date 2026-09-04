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
import { canalGrupo } from '@/lib/mensajes'
import { recalcularYGuardarRacha } from '@/lib/racha-server'
import { suscripcionesPorTipo } from '@/lib/types'

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

      // ¿Sigue inscrito en OTRA sesión del mismo grupo (ej. "Knowill" del
      // jueves, si esto es la del martes)? Si es así, no lo saques del
      // muro de mensajería del grupo — solo se sale cuando cancela su
      // última sesión de ese grupo. Debe leerse antes de cualquier
      // escritura de la transacción.
      const otrasSesionesSnap = await tx.get(
        db.collection('clases')
          .where('nombre_clase', '==', clase.nombre_clase)
          .where('estudiantes_inscritos', 'array-contains', uid),
      )
      const sigueEnOtraSesion = otrasSesionesSnap.docs.some((d) => d.id !== claseId)

      tx.update(claseSnap.ref, {
        estudiantes_inscritos: FieldValue.arrayRemove(uid),
        actualizadoEn: Date.now(),
      })

      // Rastro de la cancelación — para la Racha semanal (lib/racha.ts):
      // sin esto, una vez removido de estudiantes_inscritos no hay forma
      // de distinguir "canceló a tiempo" de "nunca se inscribió esa
      // semana", y una cancelación anticipada legítima rompería la racha
      // igual que una falta real. Llegar hasta aquí YA implica que pasó
      // la validación de la ventana de 2h de arriba, así que toda
      // escritura aquí es, por definición, una cancelación a tiempo.
      tx.set(db.collection('cancelaciones').doc(), {
        usuarioId: uid,
        claseId,
        fecha_hora_clase: clase.fecha_hora_inicio,
        canceladoEn: Date.now(),
      })

      if (!sigueEnOtraSesion) {
        // set+merge, no update: el doc de canal puede no existir todavía
        // (ej. si nadie se inscribió a este grupo desde que existe
        // mensajería) — update() en un doc inexistente falla la transacción.
        tx.set(db.collection('mensajes').doc(canalGrupo(clase.nombre_clase)), {
          participantes: FieldValue.arrayRemove(uid),
          actualizadoEn: Date.now(),
        }, { merge: true })
      }

      const asistidas = (usu.estadisticas?.clasesAsistidas as number) ?? 0
      const clasesReservadas: number = usu.estadisticas?.clasesReservadas ?? 0
      if (clasesReservadas > 0) {
        const reservadas = clasesReservadas - 1
        tx.update(usuSnap.ref, {
          'estadisticas.clasesReservadas': reservadas,
          'estadisticas.tasaAsistencia': reservadas > 0 ? Math.min(1, asistidas / reservadas) : 0,
        })
      }

      // Devuelve la sesión a la MISMA entrada que se cobró al inscribirse
      // (clase.cargosSuscripcion[uid], ver /inscribir) — necesario en
      // cuanto el usuario puede tener varios planes activos a la vez y
      // "cualquier plan con saldo" ya no identifica el correcto.
      const suscripcionIdCobrada: string | undefined = clase.cargosSuscripcion?.[uid]
      const mapaSusc: Record<string, any> = { ...(usu.suscripcionesActivas ?? {}) }
      if (usu.suscripcionActiva?.suscripcionId && !mapaSusc[usu.suscripcionActiva.suscripcionId]) {
        mapaSusc[usu.suscripcionActiva.suscripcionId] = usu.suscripcionActiva
      }

      let susc = suscripcionIdCobrada ? mapaSusc[suscripcionIdCobrada] : null
      if (!susc) {
        // Reserva de antes de este cambio (clase.cargosSuscripcion no
        // existía todavía) — mejor esfuerzo: recalcula con el mismo
        // criterio que usa /inscribir contra el estado ACTUAL del
        // usuario. Puede no ser exactamente la misma entrada si el
        // usuario cambió de planes desde que reservó.
        const candidatos = suscripcionesPorTipo({ suscripcionesActivas: mapaSusc }, ['grupal', 'conjunto', 'vacaciones'])
        if (candidatos.length > 0) {
          candidatos.sort((a, b) => a.fechaVencimiento - b.fechaVencimiento)
          susc = candidatos[0]
          log.warn({ scope: 'clases', event: 'cancelar_reembolso_sin_cargo_registrado', ip, uid, claseId, suscripcionId: susc.suscripcionId })
        }
      }

      if (susc) {
        const restantesPrev: number = susc.sesionesRestantes ?? 0
        const sesionesCompradas: number | undefined = susc.sesionesCompradas
        const cap = Number.isFinite(sesionesCompradas) ? (sesionesCompradas as number) : Number.POSITIVE_INFINITY
        const restantes = Math.max(0, Math.min(cap, restantesPrev + 1))
        const nuevoEstado = restantes > 0 ? 'activa' : susc.estado

        const yaEnMapa = !!(usu.suscripcionesActivas ?? {})[susc.suscripcionId]
        const updateSusc = yaEnMapa
          ? {
              [`suscripcionesActivas.${susc.suscripcionId}.sesionesRestantes`]: restantes,
              [`suscripcionesActivas.${susc.suscripcionId}.estado`]: nuevoEstado,
            }
          : { [`suscripcionesActivas.${susc.suscripcionId}`]: { ...susc, sesionesRestantes: restantes, estado: nuevoEstado } }

        tx.update(usuSnap.ref, {
          ...updateSusc,
          ...(usu.suscripcionActiva?.suscripcionId === susc.suscripcionId
            ? { 'suscripcionActiva.sesionesRestantes': restantes, 'suscripcionActiva.estado': nuevoEstado }
            : {}),
        })

        if (susc.suscripcionId) {
          tx.update(db.collection('suscripciones').doc(susc.suscripcionId), {
            sesiones_restantes: restantes,
            estado: nuevoEstado,
          })
        }
      }

      if (suscripcionIdCobrada) {
        tx.update(claseSnap.ref, { [`cargosSuscripcion.${uid}`]: FieldValue.delete() })
      }

      return { ok: true }
    })

    if ('error' in resultado) {
      log.info({ scope: 'clases', event: 'cancelar_rechazado', ip, uid, claseId, motivo: resultado.error })
      return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
    }
    log.info({ scope: 'clases', event: 'cancelado', ip, uid, claseId })

    // Cancelar a tiempo es un comodín para la racha (ver lib/racha.ts) —
    // best-effort: la cancelación YA se guardó arriba, si esto falla la
    // racha queda desactualizada hasta el próximo evento o el recálculo
    // perezoso de GET /api/ranking.
    recalcularYGuardarRacha(db, uid).catch((err) => {
      console.error('[cancelar] no se pudo refrescar la racha', err)
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'clases', event: 'cancelar_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
