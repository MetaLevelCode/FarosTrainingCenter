// ============================================================
// POST /api/seed-clases
// Crea instancias reales de clases (próximas N semanas) a partir de
// los horarios fijos de los grupos ya existentes. Uso puntual: poblar
// el calendario del profesor con datos reales (no de prueba/mock).
// Solo accesible por admins. Body: { instructorEmail: string, semanas?: number }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { log } from '@/lib/logger'
import { clientIp } from '@/lib/ratelimit'

export const runtime = 'nodejs'

// dow según Date.getDay(): 0=domingo, 1=lunes … 6=sábado
const GRUPOS_HORARIO = [
  {
    nombre_clase: 'Estrellas UTP', sede: 'UTP', catalogo_codigo: 'estrellas-utp', cupo_maximo: 12,
    horarios: [{ dow: 1, hora: 18 }, { dow: 3, hora: 18 }, { dow: 6, hora: 10 }],
  },
  {
    nombre_clase: 'Tiburones', sede: 'UTP', catalogo_codigo: 'knowill-vip', cupo_maximo: 10,
    horarios: [{ dow: 2, hora: 18 }, { dow: 4, hora: 18 }, { dow: 6, hora: 14 }],
  },
  {
    nombre_clase: 'Tulcán II', sede: 'TULCAN', catalogo_codigo: 'tulcan-ii', cupo_maximo: 12,
    horarios: [{ dow: 3, hora: 18 }, { dow: 5, hora: 18 }],
  },
] as const

const HORA_MS = 60 * 60 * 1000

/** Próxima fecha (Date) para un día de la semana + hora, N semanas adelante. */
function proximaFecha(dow: number, hora: number, semanaOffset: number, ahora: Date): Date {
  const d = new Date(ahora)
  d.setHours(0, 0, 0, 0)
  let diff = (dow - d.getDay() + 7) % 7
  if (diff === 0 && ahora.getHours() >= hora) diff = 7
  d.setDate(d.getDate() + diff + semanaOffset * 7)
  d.setHours(hora, 0, 0, 0)
  return d
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const db = getAdminDb()
    const adminSnap = await db.collection('usuarios').doc(decoded.uid).get()
    if (adminSnap.data()?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo admins' }, { status: 403 })
    }

    const body = await req.json() as { instructorEmail?: string; semanas?: number }
    const instructorEmail = body?.instructorEmail?.trim()
    const semanas = Number.isFinite(body?.semanas) ? (body!.semanas as number) : 4
    if (!instructorEmail) {
      return NextResponse.json({ error: 'instructorEmail es obligatorio' }, { status: 400 })
    }

    const instructor = await getAdminAuth().getUserByEmail(instructorEmail)
    const instructorSnap = await db.collection('usuarios').doc(instructor.uid).get()
    const nombreInstructor = instructorSnap.exists
      ? `${instructorSnap.data()?.nombres ?? ''} ${instructorSnap.data()?.apellidos ?? ''}`.trim()
      : undefined

    const ahora = new Date()
    const batch = db.batch()
    let creadas = 0

    for (const grupo of GRUPOS_HORARIO) {
      for (const h of grupo.horarios) {
        for (let semana = 0; semana < semanas; semana++) {
          const inicio = proximaFecha(h.dow, h.hora, semana, ahora)
          const fin = new Date(inicio.getTime() + HORA_MS)
          const ref = db.collection('clases').doc()
          batch.set(ref, {
            claseId: ref.id,
            catalogo_codigo: grupo.catalogo_codigo,
            nombre_clase: grupo.nombre_clase,
            instructor_id: instructor.uid,
            nombre_instructor: nombreInstructor,
            sede: grupo.sede,
            fecha_hora_inicio: inicio.getTime(),
            fecha_hora_fin: fin.getTime(),
            cupo_maximo: grupo.cupo_maximo,
            estudiantes_inscritos: [],
            estado: 'programada',
            creadoEn: Date.now(),
            actualizadoEn: Date.now(),
          })
          creadas++
        }
      }
    }

    await batch.commit()

    log.info({ scope: 'seed-clases', event: 'ok', ip, uid: decoded.uid, instructorEmail, creadas })
    return NextResponse.json({ ok: true, creadas })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    log.error({ scope: 'seed-clases', event: 'internal_error', ip, err })
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
