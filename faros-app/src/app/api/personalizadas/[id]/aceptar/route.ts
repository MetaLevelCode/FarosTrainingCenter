// ============================================================
// POST /api/personalizadas/[id]/aceptar
// El profesor (dueño de la solicitud) o un admin la acepta: re-valida
// disponibilidad + plan del alumno con datos frescos, chequea que no
// choque con ninguna Clase real del profesor, y genera el lote de
// clases recurrentes desde ahora hasta que vence el plan del alumno.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'
import { ocurrenciasSemanales, dowColombia, horaColombia } from '@/lib/recurrencia'

export const runtime = 'nodejs'

function franjaContenida(
  dow: number, horaInicio: string, horaFin: string,
  franjas: Array<{ dow: number; horaInicio: string; horaFin: string }>,
): boolean {
  return franjas.some((f) =>
    f.dow === dow && f.horaInicio <= horaInicio && f.horaFin >= horaFin)
}

function haySolape(aInicio: string, aFin: string, bInicio: string, bFin: string): boolean {
  return aInicio < bFin && bInicio < aFin
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'personalizadas:aceptar', { max: 15, windowMs: 60_000 })
  if (limited) {
    log.warn({ scope: 'personalizadas', event: 'rate_limited', action: 'aceptar', ip })
    return limited
  }

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const uid = decoded.uid
    const { id } = await params
    const db = getAdminDb()

    const resultado = await db.runTransaction(async (tx) => {
      const solRef = db.collection('solicitudes_personalizadas').doc(id)
      const [solSnap, requesterSnap] = await Promise.all([
        tx.get(solRef),
        tx.get(db.collection('usuarios').doc(uid)),
      ])

      if (!solSnap.exists) return { error: 'Solicitud no encontrada', status: 404 }
      const sol = solSnap.data()!
      if (sol.estado !== 'pendiente') return { error: 'Esta solicitud ya fue respondida', status: 409 }

      const requester = requesterSnap.data()
      const esDueno = sol.profesorId === uid
      const esAdmin = requester?.rol === 'admin'
      if (!esDueno && !esAdmin) return { error: 'No autorizado', status: 403 }

      const [profesorSnap, alumnoSnap] = await Promise.all([
        tx.get(db.collection('usuarios').doc(sol.profesorId)),
        tx.get(db.collection('usuarios').doc(sol.alumnoId)),
      ])
      if (!profesorSnap.exists || !alumnoSnap.exists) return { error: 'Usuario no encontrado', status: 404 }
      const profesor = profesorSnap.data()!
      const alumno = alumnoSnap.data()!

      // Re-validar disponibilidad: pudo cambiar desde que se solicitó.
      const franjas: Array<{ dow: number; horaInicio: string; horaFin: string }> = profesor.disponibilidadPersonal ?? []
      if (!franjaContenida(sol.dow, sol.horaInicio, sol.horaFin, franjas)) {
        return { error: 'Esta franja ya no está en tu disponibilidad declarada', status: 409 }
      }

      // Re-validar que el plan del alumno sigue vigente: pudo vencer
      // entre la solicitud y la aceptación.
      const susc = alumno.suscripcionActiva
      if (!susc || susc.tipo !== 'personal' || susc.estado !== 'activa' || susc.fechaVencimiento <= Date.now()) {
        return { error: 'El alumno ya no tiene un plan personalizado activo', status: 409 }
      }

      const ahora = Date.now()
      const hasta = susc.fechaVencimiento as number

      // Anti-choque: cualquier Clase real del profesor (grupal o de otro
      // alumno personalizado) que caiga el mismo día de la semana y se
      // solape en horario con la franja pedida.
      // orderBy explícito (aunque no se use el orden) para que reutilice
      // el índice compuesto [instructor_id ASC, fecha_hora_inicio DESC]
      // que ya existe para el calendario del profesor — sin esto, Firestore
      // exige un índice ASC nuevo (la dirección implícita de un rango sin
      // orderBy es siempre ascendente) y la transacción falla con
      // FAILED_PRECONDITION.
      const clasesQuery = db.collection('clases')
        .where('instructor_id', '==', sol.profesorId)
        .where('fecha_hora_inicio', '>=', ahora)
        .where('fecha_hora_inicio', '<', hasta)
        .orderBy('fecha_hora_inicio', 'desc')
      const clasesSnap = await tx.get(clasesQuery)
      const choque = clasesSnap.docs.some((d) => {
        const c = d.data()
        if (c.estado === 'cancelada') return false
        if (dowColombia(c.fecha_hora_inicio) !== sol.dow) return false
        const horaInicioC = horaColombia(c.fecha_hora_inicio)
        const horaFinC = horaColombia(c.fecha_hora_fin)
        return haySolape(sol.horaInicio, sol.horaFin, horaInicioC, horaFinC)
      })
      if (choque) return { error: 'Este horario ya está ocupado por otra clase', status: 409 }

      const ocurrencias = ocurrenciasSemanales(sol.dow, sol.horaInicio, sol.horaFin, new Date(ahora), hasta)
      const nombreAlumno = sol.nombreAlumno ?? 'Alumno'
      const nombreInstructor = `${profesor.nombres ?? ''} ${profesor.apellidos ?? ''}`.trim()
      const clasesGeneradas: string[] = []
      for (const oc of ocurrencias) {
        const claseRef = db.collection('clases').doc()
        tx.set(claseRef, {
          claseId: claseRef.id,
          catalogo_codigo: 'personalizada',
          nombre_clase: `Personalizada — ${nombreAlumno}`,
          instructor_id: sol.profesorId,
          nombre_instructor: nombreInstructor || undefined,
          sede: profesor.sede ?? alumno.sede ?? '',
          fecha_hora_inicio: oc.inicio,
          fecha_hora_fin: oc.fin,
          cupo_maximo: sol.personas ?? 1,
          estudiantes_inscritos: [sol.alumnoId],
          estado: 'programada',
          creadoEn: ahora,
          actualizadoEn: ahora,
        })
        clasesGeneradas.push(claseRef.id)
      }

      tx.update(solRef, {
        estado: 'aceptada',
        respondidoEn: ahora,
        clasesGeneradas,
        rangoGeneradoHasta: hasta,
      })

      return { ok: true as const, clasesCreadas: clasesGeneradas.length }
    })

    if ('error' in resultado) {
      log.info({ scope: 'personalizadas', event: 'aceptar_rechazado', ip, uid, solicitudId: id, motivo: resultado.error })
      return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
    }
    log.info({ scope: 'personalizadas', event: 'aceptada', ip, uid, solicitudId: id, clasesCreadas: resultado.clasesCreadas })
    return NextResponse.json({ ok: true, clasesCreadas: resultado.clasesCreadas })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'personalizadas', event: 'aceptar_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
