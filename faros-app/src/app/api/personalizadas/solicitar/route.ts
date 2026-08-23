// ============================================================
// POST /api/personalizadas/solicitar
// Alumno con plan personal activo solicita una franja de las que el
// profesor declaró en su disponibilidad. Queda 'pendiente' hasta que
// el profesor la acepte o rechace (ver ./[id]/aceptar, ./[id]/rechazar).
// Body: { profesorId, dow, horaInicio, horaFin, mensaje? }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'

export const runtime = 'nodejs'

const HORA_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

function franjaContenida(
  dow: number, horaInicio: string, horaFin: string,
  franjas: Array<{ dow: number; horaInicio: string; horaFin: string }>,
): boolean {
  return franjas.some((f) =>
    f.dow === dow && f.horaInicio <= horaInicio && f.horaFin >= horaFin)
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
      profesorId?: string; dow?: number; horaInicio?: string; horaFin?: string; mensaje?: string
    } | null
    const profesorId = body?.profesorId
    const dow = body?.dow
    const horaInicio = body?.horaInicio
    const horaFin = body?.horaFin
    const mensaje = body?.mensaje?.trim().slice(0, 500) || null

    if (!profesorId || typeof dow !== 'number' || dow < 0 || dow > 6
      || !horaInicio || !HORA_RE.test(horaInicio)
      || !horaFin || !HORA_RE.test(horaFin)
      || horaInicio >= horaFin) {
      return NextResponse.json({ error: 'Datos de la solicitud inválidos' }, { status: 400 })
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

      const susc = alumno.suscripcionActiva
      if (!susc || susc.tipo !== 'personal' || susc.estado !== 'activa' || susc.fechaVencimiento <= Date.now()) {
        return { error: 'Necesitas un plan personalizado activo para solicitar una clase', status: 403 }
      }

      if (!profesorSnap.exists) return { error: 'Profesor no encontrado', status: 404 }
      const profesor = profesorSnap.data()!
      if (profesor.rol !== 'profesor') return { error: 'El destinatario no es un profesor', status: 400 }

      const franjas: Array<{ dow: number; horaInicio: string; horaFin: string }> = profesor.disponibilidadPersonal ?? []
      if (!franjaContenida(dow, horaInicio, horaFin, franjas)) {
        return { error: 'Esta franja no está en la disponibilidad del profesor', status: 409 }
      }

      const nombreAlumno = `${alumno.nombres ?? ''} ${alumno.apellidos ?? ''}`.trim() || 'Alumno'
      const solRef = db.collection('solicitudes_personalizadas').doc()
      const now = Date.now()
      tx.set(solRef, {
        solicitudId: solRef.id,
        alumnoId: uid,
        nombreAlumno,
        profesorId,
        dow,
        horaInicio,
        horaFin,
        personas: susc.personas ?? 1,
        estado: 'pendiente',
        mensaje,
        motivoRechazo: null,
        creadoEn: now,
        respondidoEn: null,
        clasesGeneradas: [],
        rangoGeneradoHasta: null,
      })

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
