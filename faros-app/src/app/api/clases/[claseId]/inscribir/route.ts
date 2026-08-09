// ============================================================
// POST /api/clases/[claseId]/inscribir
// Inscribe al estudiante en una clase de forma atómica:
//   - Valida suscripción activa + sesiones > 0
//   - Valida cupo disponible + clase programada + no inscrito ya
//   - arrayUnion uid en estudiantes_inscritos
//   - Incrementa estadisticas.clasesReservadas
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/admin'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ claseId: string }> },
) {
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
      tx.update(usuSnap.ref, {
        'estadisticas.clasesReservadas': FieldValue.increment(1),
      })

      return { ok: true }
    })

    if ('error' in resultado) {
      return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    console.error('[POST /api/clases/inscribir]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
