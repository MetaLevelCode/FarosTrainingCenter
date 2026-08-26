// ============================================================
// GET /api/ranking
// Devuelve TODOS los estudiantes con su racha semanal y clases
// asistidas, ordenados por racha desc (empate → asistidas desc).
//
// La racha vive cacheada en usuarios/{uid}.estadisticas.{racha,rachaSemana}
// (se mantiene fresca en cada evento — ver lib/racha-server.ts, usado por
// registrarAsistencia y /api/clases/[id]/cancelar). Acá solo se recalcula
// — con las 3 lecturas completas de asistencias/clases/cancelaciones —
// para quien quedó desactualizado: alguien cuya `rachaSemana` cacheada es
// de una semana anterior a la actual, típicamente porque dejó de asistir
// y ningún evento disparó el recálculo (la racha se rompe por INACCIÓN,
// no solo por acción). Para el resto es una lectura ya hecha, sin costo
// extra. Sigue en Admin SDK porque las reglas de Firestore no dejan que
// un estudiante lea las asistencias/cancelaciones de OTRO estudiante.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'
import { inicioSemana } from '@/lib/racha'
import { recalcularYGuardarRacha } from '@/lib/racha-server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'ranking', { max: 20, windowMs: 60_000 })
  if (limited) {
    log.warn({ scope: 'ranking', event: 'rate_limited', ip })
    return limited
  }

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })
    await getAdminAuth().verifyIdToken(token)

    const db = getAdminDb()
    const estudiantesSnap = await db.collection('usuarios').where('rol', '==', 'estudiante').get()
    const semanaActual = inicioSemana(Date.now())

    const ranking = await Promise.all(estudiantesSnap.docs.map(async (doc) => {
      const u = doc.data()
      const uid = doc.id
      const nombre = `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim() || 'Alumno'
      const asistidas = u.estadisticas?.clasesAsistidas ?? 0

      const cacheValida = typeof u.estadisticas?.rachaSemana === 'number'
        && u.estadisticas.rachaSemana >= semanaActual
      const racha = cacheValida
        ? u.estadisticas.racha ?? 0
        : await recalcularYGuardarRacha(db, uid).catch(() => u.estadisticas?.racha ?? 0)

      return { uid, nombre, racha, asistidas }
    }))

    ranking.sort((a, b) => b.racha - a.racha || b.asistidas - a.asistidas)

    return NextResponse.json({ ranking })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'ranking', event: 'error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
