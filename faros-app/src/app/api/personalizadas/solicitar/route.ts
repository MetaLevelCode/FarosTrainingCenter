// ============================================================
// POST /api/personalizadas/solicitar
// Alumno con plan personal activo solicita N franjas (N = la frecuencia
// semanal de su plan: 1x/2x/3x) de las que el profesor declaró en su
// disponibilidad, todas con el mismo profesor y en días distintos. Queda
// 'pendiente' hasta que el profesor la acepte o rechace (ver ./[id]/aceptar,
// ./[id]/rechazar).
// Body: { profesorId, franjas: [{ dow, horaInicio, horaFin }, ...], direccion,
//         mensaje?, suscripcionId? } — suscripcionId identifica de cuál
// de las (potencialmente varias) entradas tipo:'personal' del alumno es
// esta solicitud (ej. natación personalizada vs actividad física);
// opcional si el alumno solo tiene un plan personal activo.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'
import {
  DURACION_PERSONALIZADA_MIN, sumarMinutos, franjaContenida, haySolape, dowColombia, horaColombia,
} from '@/lib/recurrencia'
import { notifPayload } from '@/lib/notificaciones'
import { suscripcionPersonal } from '@/lib/types'

export const runtime = 'nodejs'

const HORA_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

interface FranjaBody { dow?: number; horaInicio?: string; horaFin?: string }

function franjaValida(f: FranjaBody | null | undefined): f is Required<FranjaBody> {
  if (!f) return false
  if (typeof f.dow !== 'number' || f.dow < 0 || f.dow > 6) return false
  if (!f.horaInicio || !HORA_RE.test(f.horaInicio)) return false
  if (!f.horaFin || !HORA_RE.test(f.horaFin)) return false
  if (f.horaInicio >= f.horaFin) return false
  // Cada clase dura DURACION_PERSONALIZADA_MIN, aunque el profesor haya
  // declarado una franja de disponibilidad más amplia — el alumno pide
  // un horario de inicio dentro de esa franja, no la franja completa.
  return f.horaFin === sumarMinutos(f.horaInicio, DURACION_PERSONALIZADA_MIN)
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'personalizadas:solicitar', { max: 10, windowMs: 60_000 })
  if (limited) {
    log.warn({ scope: 'personalizadas', event: 'rate_limited', action: 'solicitar', ip })
    return limited
  }

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const uid = decoded.uid
    const db = getAdminDb()

    const body = await req.json().catch(() => null) as {
      profesorId?: string; franjas?: FranjaBody[]
      direccion?: string; mensaje?: string; suscripcionId?: string
    } | null
    const profesorId = body?.profesorId
    const franjas = body?.franjas
    const direccion = body?.direccion?.trim().slice(0, 300)
    const mensaje = body?.mensaje?.trim().slice(0, 500) || null
    // De cuál de las (potencialmente varias) entradas tipo:'personal' del
    // alumno es esta solicitud — ej. natación personalizada vs actividad
    // física. Si no se manda (alumno con un solo plan personal), se
    // resuelve más abajo con suscripcionPersonal() sin selector.
    const suscripcionIdBody = body?.suscripcionId

    if (!profesorId || !Array.isArray(franjas) || franjas.length === 0 || franjas.length > 3
      || !franjas.every(franjaValida)) {
      return NextResponse.json({ error: 'Datos de la solicitud inválidos' }, { status: 400 })
    }
    if (new Set(franjas.map((f) => f.dow)).size !== franjas.length) {
      return NextResponse.json({ error: 'Elige días distintos para cada franja' }, { status: 400 })
    }

    // La clase personalizada ocurre en la casa/conjunto del alumno, no en
    // una sede fija — sin dirección el profesor no sabe a dónde ir.
    if (!direccion) {
      return NextResponse.json({ error: 'Indica la dirección donde será la clase' }, { status: 400 })
    }

    // Anti-spam: no permitir una segunda solicitud pendiente al mismo
    // profesor (chequeo simple, no necesita ser transaccional).
    const pendienteSnap = await db.collection('solicitudes_personalizadas')
      .where('alumnoId', '==', uid)
      .where('profesorId', '==', profesorId)
      .where('estado', '==', 'pendiente')
      .limit(1)
      .get()
    if (!pendienteSnap.empty) {
      return NextResponse.json({ error: 'Ya tienes una solicitud pendiente con este profesor' }, { status: 409 })
    }

    const resultado = await db.runTransaction(async (tx) => {
      const [alumnoSnap, profesorSnap] = await Promise.all([
        tx.get(db.collection('usuarios').doc(uid)),
        tx.get(db.collection('usuarios').doc(profesorId)),
      ])

      if (!alumnoSnap.exists) return { error: 'Usuario no encontrado', status: 404 }
      const alumno = alumnoSnap.data()!
      if (alumno.rol !== 'estudiante') return { error: 'Solo estudiantes pueden solicitar clases personalizadas', status: 403 }
      if (alumno.activo === false) return { error: 'Tu cuenta está suspendida', status: 403 }

      // El alumno puede tener VARIAS entradas tipo:'personal' a la vez
      // (ej. natación personalizada + actividad física) — si mandó
      // suscripcionId (selector en la UI cuando hay más de una), se usa
      // esa puntual; si no, se cae a la única disponible (compat con
      // alumnos con un solo plan personal, y con usuarios que aún no
      // pasaron por la migración a suscripcionesActivas).
      const mapaAlumno = {
        suscripcionesActivas: alumno.suscripcionesActivas
          ?? (alumno.suscripcionActiva?.suscripcionId ? { [alumno.suscripcionActiva.suscripcionId]: alumno.suscripcionActiva } : {}),
      }
      const susc = suscripcionIdBody
        ? mapaAlumno.suscripcionesActivas[suscripcionIdBody]
        : suscripcionPersonal(mapaAlumno)
      if (!susc || susc.tipo !== 'personal' || susc.estado !== 'activa' || susc.fechaVencimiento <= Date.now()) {
        return { error: 'Necesitas un plan personalizado activo para solicitar una clase', status: 403 }
      }
      // Modalidades grupales (pareja/familia/reducido): solo quien compró
      // el plan (jefe del grupo) elige la franja — los demás miembros
      // quedan inscritos automáticamente cuando el profesor acepte.
      if (susc.grupoId && !susc.esJefeGrupo) {
        return { error: 'Solo quien adquirió el plan puede elegir el horario del grupo', status: 403 }
      }

      const franjasRequeridas = susc.week ?? 1
      if (franjas.length !== franjasRequeridas) {
        return {
          error: `Tu plan es ${franjasRequeridas} ${franjasRequeridas === 1 ? 'vez' : 'veces'} por semana — elige ${franjasRequeridas} ${franjasRequeridas === 1 ? 'franja' : 'franjas'}`,
          status: 400,
        }
      }

      if (!profesorSnap.exists) return { error: 'Profesor no encontrado', status: 404 }
      const profesor = profesorSnap.data()!
      if (profesor.rol !== 'profesor') return { error: 'El destinatario no es un profesor', status: 400 }

      const disponibilidad: Array<{ dow: number; horaInicio: string; horaFin: string }> = profesor.disponibilidadPersonal ?? []
      for (const f of franjas) {
        if (!franjaContenida(f.dow!, f.horaInicio!, f.horaFin!, disponibilidad)) {
          return { error: 'Alguna franja no está en la disponibilidad del profesor', status: 409 }
        }
      }

      // Anti-choque: no dejar crear una solicitud condenada a ser rechazada
      // porque algún horario ya quedó ocupado por otra Clase real del
      // profesor (grupal o de otro alumno personalizado ya aceptado). Mismo
      // chequeo que hace aceptar/route.ts, adelantado aquí para no hacerle
      // perder el tiempo al alumno ni ensuciarle la bandeja de pendientes
      // al profesor.
      const ahora = Date.now()
      const hasta = susc.fechaVencimiento as number
      const clasesQuery = db.collection('clases')
        .where('instructor_id', '==', profesorId)
        .where('fecha_hora_inicio', '>=', ahora)
        .where('fecha_hora_inicio', '<', hasta)
        .orderBy('fecha_hora_inicio', 'desc')
      const clasesSnap = await tx.get(clasesQuery)
      const clasesReales = clasesSnap.docs
        .map((d) => d.data())
        .filter((c) => c.estado !== 'cancelada')

      for (const f of franjas) {
        const choque = clasesReales.some((c) => {
          if (dowColombia(c.fecha_hora_inicio) !== f.dow) return false
          const horaInicioC = horaColombia(c.fecha_hora_inicio)
          const horaFinC = horaColombia(c.fecha_hora_fin)
          return haySolape(f.horaInicio!, f.horaFin!, horaInicioC, horaFinC)
        })
        if (choque) return { error: 'Alguno de los horarios ya está ocupado, elige otro', status: 409 }
      }

      const nombreAlumno = `${alumno.nombres ?? ''} ${alumno.apellidos ?? ''}`.trim() || 'Alumno'
      const solRef = db.collection('solicitudes_personalizadas').doc()
      const now = Date.now()
      tx.set(solRef, {
        solicitudId: solRef.id,
        alumnoId: uid,
        nombreAlumno,
        profesorId,
        franjas,
        direccion,
        suscripcionId: susc.suscripcionId,
        personas: susc.personas ?? 1,
        grupoId: susc.grupoId ?? null,
        estado: 'pendiente',
        mensaje,
        motivoRechazo: null,
        mensajeProfesor: null,
        creadoEn: now,
        respondidoEn: null,
        clasesGeneradas: [],
        rangoGeneradoHasta: null,
      })

      const notifRef = db.collection('notificaciones').doc()
      tx.set(notifRef, notifPayload({
        destinatarioId: profesorId,
        tipo: 'clase_solicitada',
        titulo: 'Nueva solicitud de horario',
        mensaje: `${nombreAlumno} pidió una clase personalizada.`,
        enlace: '/portal',
        actorId: uid,
      }))

      return { ok: true as const, solicitudId: solRef.id }
    })

    if ('error' in resultado) {
      log.info({ scope: 'personalizadas', event: 'solicitar_rechazado', ip, uid, profesorId, motivo: resultado.error })
      return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
    }
    log.info({ scope: 'personalizadas', event: 'solicitada', ip, uid, profesorId, solicitudId: resultado.solicitudId })
    return NextResponse.json({ ok: true, solicitudId: resultado.solicitudId })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'personalizadas', event: 'solicitar_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
