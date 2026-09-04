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
//   - El usuario puede tener VARIOS planes activos a la vez
//     (suscripcionesActivas, ver lib/types.ts) — esta ruta solo cobra
//     entradas tipo grupal/conjunto/vacaciones (las personalizadas nunca
//     pasan por acá, ver chequeo de catalogo_codigo abajo). Si hay más
//     de un candidato, se cobra el que vence más pronto primero, y se
//     registra en clase.cargosSuscripcion[uid] para que /cancelar
//     reembolse exactamente esa misma entrada.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'
import { canalGrupo } from '@/lib/mensajes'
import { suscripcionesPorTipo } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * Une el mapa suscripcionesActivas con el campo legacy suscripcionActiva
 * (por si este usuario aún no pasó por la migración/dual-write) para que
 * la selección de candidatos nunca deje a alguien sin su plan real solo
 * por timing del rollout. Ver PLAN de refactor (Release 3).
 */
function mapaSuscripciones(usu: Record<string, any>): Record<string, any> {
  const mapa: Record<string, any> = { ...(usu.suscripcionesActivas ?? {}) }
  const legacy = usu.suscripcionActiva
  if (legacy?.suscripcionId && !mapa[legacy.suscripcionId]) mapa[legacy.suscripcionId] = legacy
  return mapa
}

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

      // El usuario puede tener varios planes activos a la vez — de los
      // que cubren clases abiertas (grupal/conjunto/vacaciones; los
      // 'personal' se agendan aparte, ver /api/personalizadas/*), se
      // cobra el que tenga sesiones Y venza más pronto.
      const mapaSusc = mapaSuscripciones(usu)
      const candidatos = suscripcionesPorTipo({ suscripcionesActivas: mapaSusc }, ['grupal', 'conjunto', 'vacaciones'])
      if (candidatos.length === 0) {
        return { error: 'Necesitas una suscripción activa para inscribirte', status: 403 }
      }
      const conSesiones = candidatos.filter((s) => (s.sesionesRestantes ?? 0) > 0)
      if (conSesiones.length === 0) {
        return { error: 'No tienes sesiones disponibles en tu plan actual', status: 403 }
      }
      conSesiones.sort((a, b) => a.fechaVencimiento - b.fechaVencimiento)
      const susc = conSesiones[0]

      // Las personalizadas ya tienen dueño fijo (1-a-1 o grupo cerrado
      // agendado por /api/personalizadas/[id]/aceptar) — no son un cupo
      // abierto. Sin este chequeo, cualquier alumno de la misma sede podía
      // auto-inscribirse llamando esta ruta directo, aunque el wizard/UI
      // ya no se las muestre.
      if (clase.catalogo_codigo === 'personalizada') {
        return { error: 'Esta clase es personalizada — no está abierta para inscripción libre', status: 403 }
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
        [`cargosSuscripcion.${uid}`]: susc.suscripcionId,
        actualizadoEn: Date.now(),
      })

      // Muro de mensajería del grupo: agrega al alumno (y re-agrega al
      // instructor, idempotente) a la lista de miembros del canal — ver
      // firestore.rules y lib/mensajes.ts (otras rutas que tocan
      // estudiantes_inscritos hacen lo mismo).
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

      // Si la entrada cobrada ya vivía en suscripcionesActivas, un
      // dot-path parcial alcanza; si vino del fallback legacy (usuario
      // aún no migrado, ver mapaSuscripciones()) hay que escribir la
      // entrada completa para no dejar el resto de sus campos vacíos.
      const yaEnMapa = !!mapaSusc[susc.suscripcionId] && !!(usu.suscripcionesActivas ?? {})[susc.suscripcionId]
      const updateSusc = yaEnMapa
        ? {
            [`suscripcionesActivas.${susc.suscripcionId}.sesionesRestantes`]: restantes,
            [`suscripcionesActivas.${susc.suscripcionId}.estado`]: nuevoEstado,
          }
        : { [`suscripcionesActivas.${susc.suscripcionId}`]: { ...susc, sesionesRestantes: restantes, estado: nuevoEstado } }

      tx.update(usuSnap.ref, {
        'estadisticas.clasesReservadas': reservadas,
        'estadisticas.tasaAsistencia': reservadas > 0 ? Math.min(1, asistidas / reservadas) : 0,
        ...updateSusc,
        // Dual-write: si esta es la entrada que también vive en el
        // campo legacy, se mantiene coherente mientras dure la
        // transición (ver PLAN de refactor, Release 4 la retira).
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
