// ============================================================
// GET /api/profesores/publico
// Devuelve el subconjunto seguro de cada profesor (nombres, apellidos,
// foto_perfil, disponibilidadPersonal) para pantallas YA autenticadas
// que necesitan más que perfiles_publicos/{uid} (que solo trae
// nombres/apellidos/rol para el wizard sin login): mensajes (avatar de
// chat) y SolicitudPersonalizada (franjas para clases 1-a-1). Nunca
// cédula/teléfono/email/EPS/dificultades.
//
// Cualquier usuario autenticado puede llamarla — firestore.rules no
// deja que un alumno lea usuarios/{uid} de otro usuario directo, así
// que el filtrado por rol y la selección de campos se hacen acá,
// server-side con Admin SDK.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'profesores:publico', { max: 30, windowMs: 60_000 })
  if (limited) return limited

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })
    await getAdminAuth().verifyIdToken(token)

    const db = getAdminDb()
    const snap = await db.collection('usuarios').where('rol', '==', 'profesor').get()
    const profesores = snap.docs
      .filter((doc) => doc.data().activo !== false)
      .map((doc) => {
        const d = doc.data()
        return {
          uid: doc.id,
          nombres: d.nombres ?? '',
          apellidos: d.apellidos ?? '',
          foto_perfil: d.foto_perfil ?? null,
          disponibilidadPersonal: d.disponibilidadPersonal ?? [],
        }
      })

    return NextResponse.json({ profesores })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'profesores', event: 'publico_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
