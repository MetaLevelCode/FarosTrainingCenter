// ============================================================
// POST /api/mensajes/backfill
// Uso puntual: la mensajería (Fase 5) solo puebla mensajes/{canalId}.
// participantes hacia ADELANTE, desde el próximo inscribir/cancelar
// (ver PLAN_DE_CIERRE.md 6.14). Los alumnos que ya estaban inscritos
// ANTES de ese deploy no tienen canal — no pueden ni leer ni escribir
// en el muro de su grupo (firestore.rules exige ser miembro listado).
// Este endpoint recorre TODAS las clases y reconstruye participantes
// desde estudiantes_inscritos + instructor_id real. Idempotente.
// Solo accesible por admins.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { log } from '@/lib/logger'
import { clientIp } from '@/lib/ratelimit'
import { canalGrupo } from '@/lib/mensajes'

export const runtime = 'nodejs'

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

    const clasesSnap = await db.collection('clases').get()

    // Agrupa por canal antes de escribir: varias clases (distintas
    // sesiones/instructores) pueden compartir el mismo nombre_clase.
    const porCanal = new Map<string, { nombre: string; miembros: Set<string> }>()
    for (const doc of clasesSnap.docs) {
      const c = doc.data()
      if (!c.nombre_clase) continue
      const canalId = canalGrupo(c.nombre_clase)
      const entry = porCanal.get(canalId) ?? { nombre: c.nombre_clase, miembros: new Set<string>() }
      for (const uid of (c.estudiantes_inscritos ?? []) as string[]) entry.miembros.add(uid)
      if (c.instructor_id) entry.miembros.add(c.instructor_id)
      porCanal.set(canalId, entry)
    }

    let batch = db.batch()
    let ops = 0
    let canales = 0
    for (const [canalId, { nombre, miembros }] of porCanal) {
      if (miembros.size === 0) continue
      batch.set(db.collection('mensajes').doc(canalId), {
        tipo: 'grupo',
        nombre,
        participantes: FieldValue.arrayUnion(...miembros),
        actualizadoEn: Date.now(),
      }, { merge: true })
      canales++
      ops++
      if (ops >= 450) { await batch.commit(); batch = db.batch(); ops = 0 }
    }
    if (ops > 0) await batch.commit()

    log.info({ scope: 'mensajes', event: 'backfill_ok', ip, uid: decoded.uid, canales })
    return NextResponse.json({ ok: true, clasesRevisadas: clasesSnap.size, canalesActualizados: canales })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    log.error({ scope: 'mensajes', event: 'backfill_error', ip, err })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
