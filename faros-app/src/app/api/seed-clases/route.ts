// ============================================================
// POST /api/seed-clases
// Crea instancias reales de clases (próximas N semanas) leyendo
// directamente los grupos (Firestore: grupos/), su `coachId` y sus
// `horarios` (["Lun · 6:00 PM", ...]) — ya no depende de una lista
// hardcodeada de grupos ni de que el admin escriba a mano el correo
// del instructor: cada grupo trae su propio coach.
//
// Body: { grupoId?: string, semanas?: number }
//   - grupoId presente  → regenera solo ese grupo (aunque no tenga
//     `disponible: true`, por si sigue con alumnos activos).
//   - grupoId ausente   → recorre TODOS los grupos con coachId asignado.
// Idempotente: no duplica una clase que ya exista para el mismo grupo
// en el mismo fecha_hora_inicio — reasignar instructor a clases ya
// creadas es responsabilidad de sincronizarInstructorGrupo() (lib/firestore.ts),
// no de este endpoint.
// Solo accesible por admins.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { log } from '@/lib/logger'
import { clientIp } from '@/lib/ratelimit'
import { ocurrenciasSemanales, sumarMinutos } from '@/lib/recurrencia'

export const runtime = 'nodejs'

const DURACION_GRUPAL_MIN = 60

const DIAS: Record<string, number> = { dom: 0, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6 }

function normalizarDia(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3)
}

/** "Lun · 6:00 PM" → { dow: 1, horaInicio: '18:00' }. null si no reconoce el formato. */
function parseHorario(h: string): { dow: number; horaInicio: string } | null {
  const partes = h.split('·').map((p) => p.trim())
  if (partes.length !== 2) return null
  const dow = DIAS[normalizarDia(partes[0])]
  if (dow === undefined) return null
  const m = partes[1].match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let hora = Number(m[1]) % 12
  if (/pm/i.test(m[3])) hora += 12
  const minuto = Number(m[2])
  return { dow, horaInicio: `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}` }
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

    const body = await req.json().catch(() => ({})) as { grupoId?: string; semanas?: number }
    const semanas = Number.isFinite(body?.semanas) ? (body!.semanas as number) : 4

    const gruposSnap = body?.grupoId
      ? await db.collection('grupos').doc(body.grupoId).get().then((d) => (d.exists ? [d] : []))
      : await db.collection('grupos').get().then((s) => s.docs)

    if (body?.grupoId && gruposSnap.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    }

    const ahora = new Date()
    const hastaTs = ahora.getTime() + semanas * 7 * 24 * 60 * 60 * 1000
    const batch = db.batch()
    let creadas = 0
    const gruposSinCoach: string[] = []
    const horariosInvalidos: string[] = []

    for (const grupoDoc of gruposSnap) {
      const grupo = grupoDoc.data() as {
        nombre: string; sedeCodigo: string; horarios: string[]; coachId?: string; cupoMaximo?: number
      }
      if (!grupo.coachId) {
        gruposSinCoach.push(grupo.nombre ?? grupoDoc.id)
        continue
      }

      const instructorSnap = await db.collection('usuarios').doc(grupo.coachId).get()
      if (!instructorSnap.exists) {
        gruposSinCoach.push(grupo.nombre ?? grupoDoc.id)
        continue
      }
      const nombreInstructor = `${instructorSnap.data()?.nombres ?? ''} ${instructorSnap.data()?.apellidos ?? ''}`.trim()

      // Ocurrencias ya creadas para este grupo — evita duplicar si se corre
      // el endpoint más de una vez (ej. el admin reasigna coach y regenera).
      const existentesSnap = await db.collection('clases')
        .where('nombre_clase', '==', grupo.nombre)
        .where('estado', '==', 'programada')
        .get()
      const yaExisten = new Set(existentesSnap.docs.map((d) => d.data().fecha_hora_inicio))

      for (const horarioStr of grupo.horarios ?? []) {
        const parsed = parseHorario(horarioStr)
        if (!parsed) { horariosInvalidos.push(`${grupo.nombre}: "${horarioStr}"`); continue }
        const horaFin = sumarMinutos(parsed.horaInicio, DURACION_GRUPAL_MIN)
        const ocurrencias = ocurrenciasSemanales(parsed.dow, parsed.horaInicio, horaFin, ahora, hastaTs)

        for (const oc of ocurrencias) {
          if (yaExisten.has(oc.inicio)) continue
          const ref = db.collection('clases').doc()
          batch.set(ref, {
            claseId: ref.id,
            catalogo_codigo: grupoDoc.id,
            nombre_clase: grupo.nombre,
            instructor_id: grupo.coachId,
            nombre_instructor: nombreInstructor,
            sede: grupo.sedeCodigo,
            fecha_hora_inicio: oc.inicio,
            fecha_hora_fin: oc.fin,
            cupo_maximo: grupo.cupoMaximo ?? 12,
            estudiantes_inscritos: [],
            estado: 'programada',
            creadoEn: Date.now(),
            actualizadoEn: Date.now(),
          })
          creadas++
        }
      }
    }

    if (creadas > 0) await batch.commit()

    log.info({ scope: 'seed-clases', event: 'ok', ip, uid: decoded.uid, grupoId: body?.grupoId, creadas, gruposSinCoach, horariosInvalidos })
    return NextResponse.json({ ok: true, creadas, gruposSinCoach, horariosInvalidos })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    log.error({ scope: 'seed-clases', event: 'internal_error', ip, err })
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
