// ============================================================
// POST /api/invitaciones
// Verifica y consume un código de invitación de forma atómica.
// Un cliente no puede leer la colección codigos_invitacion directamente
// (Firestore rules la bloquean), así que la verificación pasa por aquí.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/admin'

export const runtime = 'nodejs'

const FORMATO = /^FAROS-COACH-[A-Z0-9]{4}$/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { codigo?: string; correo?: string }
    const codigo = body?.codigo?.trim().toUpperCase() ?? ''
    const correo = body?.correo?.trim() ?? ''

    if (!codigo) {
      return NextResponse.json({ valido: false, motivo: 'vacio' })
    }
    if (!FORMATO.test(codigo)) {
      return NextResponse.json({ valido: false, motivo: 'inexistente' })
    }

    const db = getAdminDb()
    const ref = db.collection('codigos_invitacion').doc(codigo)

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { valido: false, motivo: 'inexistente' } as const
      const d = snap.data()!
      if (d.activo === false) return { valido: false, motivo: 'inexistente' } as const
      if (d.usadoPor) return { valido: false, motivo: 'usado' } as const

      tx.update(ref, { usadoPor: correo, usadoEn: Date.now() })
      return { valido: true, rol: (d.rol as string) ?? 'profesor' }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/invitaciones]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
