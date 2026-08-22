// ============================================================
// GET /api/grupos/cupos
// Cuenta cuántas suscripciones activas (y no vencidas) usan cada
// grupo — para mostrar "cupos disponibles" reales en el wizard.
// Ruta pública y sin PII: firestore.rules no deja que un alumno lea
// la colección suscripciones/ de otros usuarios, así que el conteo
// tiene que hacerse server-side con Admin SDK. Solo se devuelven
// números agregados por grupoId, nunca los documentos.
// ============================================================

import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/admin'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const db = getAdminDb()
    const snap = await db.collection('suscripciones').where('estado', '==', 'activa').get()

    const now = Date.now()
    const conteo: Record<string, number> = {}
    snap.forEach((doc) => {
      const d = doc.data()
      // Defensivo: por si alguna suscripción quedó marcada 'activa' pese a
      // haber vencido (no hay job que las pase a 'vencida' automáticamente).
      if (typeof d.fecha_vencimiento === 'number' && d.fecha_vencimiento < now) return
      const grupoId = d.seleccion?.grupoId
      if (grupoId) conteo[grupoId] = (conteo[grupoId] ?? 0) + 1
    })

    return NextResponse.json({ inscritosPorGrupo: conteo })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
