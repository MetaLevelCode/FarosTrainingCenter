// ============================================================
// POST /api/invitaciones
// Verifica y consume un código de invitación de forma atómica.
// Un cliente no puede leer la colección codigos_invitacion directamente
// (Firestore rules la bloquean), así que la verificación pasa por aquí.
// Endpoint público (el usuario aún no está registrado al validar el
// código durante signup), por eso el rate limit es agresivo.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'

export const runtime = 'nodejs'

const FORMATO = /^FAROS-COACH-[A-Z0-9]{4}$/
// RFC 5322 simplificado — suficiente para rechazar payloads obviamente inválidos
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const ip = clientIp(req)

  // Rate limit agresivo: 5 intentos por IP por minuto (frena brute force).
  const limited = rateLimit(req, 'invitaciones', { max: 5, windowMs: 60_000 })
  if (limited) {
    log.warn({ scope: 'invitaciones', event: 'rate_limited', ip })
    return limited
  }

  try {
    const body = await req.json() as { codigo?: string; correo?: string }
    const codigo = body?.codigo?.trim().toUpperCase() ?? ''
    const correo = body?.correo?.trim().toLowerCase() ?? ''

    if (!codigo) {
      return NextResponse.json({ valido: false, motivo: 'vacio' })
    }
    if (!FORMATO.test(codigo)) {
      log.info({ scope: 'invitaciones', event: 'formato_invalido', ip, codigo })
      return NextResponse.json({ valido: false, motivo: 'inexistente' })
    }
    if (!EMAIL.test(correo)) {
      log.info({ scope: 'invitaciones', event: 'correo_invalido', ip })
      return NextResponse.json({ valido: false, motivo: 'correo_invalido' })
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

    if (result.valido) {
      log.info({ scope: 'invitaciones', event: 'consumido', ip, codigo, rol: result.rol })
    } else {
      log.info({ scope: 'invitaciones', event: 'rechazado', ip, motivo: result.motivo })
    }
    return NextResponse.json(result)
  } catch (err) {
    log.error({ scope: 'invitaciones', event: 'internal_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
