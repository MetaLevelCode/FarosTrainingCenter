// ============================================================
// POST /api/admin/usuarios/[uid]/rol
// Cambia el rol de un usuario. Solo admins. Reemplaza el antiguo
// updateDoc directo del cliente (setUsuarioRol) porque ahora también
// hay que sincronizar perfiles_publicos/{uid} en la misma operación
// (ver nota de schema en firestore.rules):
//   - rol pasa a 'profesor'  → crea/actualiza perfiles_publicos/{uid}
//     con el subconjunto público (nombres, apellidos, rol).
//   - rol deja de ser 'profesor' → borra perfiles_publicos/{uid}.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'

export const runtime = 'nodejs'

const ROLES_VALIDOS = ['admin', 'profesor', 'estudiante']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'admin:usuarios:rol', { max: 20, windowMs: 60_000 })
  if (limited) return limited

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const db = getAdminDb()
    const adminSnap = await db.collection('usuarios').doc(decoded.uid).get()
    if (adminSnap.data()?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo admins' }, { status: 403 })
    }

    const { uid } = await params
    const body = await req.json().catch(() => ({})) as { rol?: string }
    const rol = body?.rol
    if (!rol || !ROLES_VALIDOS.includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }

    const userRef = db.collection('usuarios').doc(uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }
    const u = userSnap.data()!

    const batch = db.batch()
    batch.update(userRef, { rol })
    const perfilRef = db.collection('perfiles_publicos').doc(uid)
    if (rol === 'profesor') {
      batch.set(perfilRef, { nombres: u.nombres ?? '', apellidos: u.apellidos ?? '', rol: 'profesor' })
    } else {
      batch.delete(perfilRef)
    }
    await batch.commit()

    log.info({ scope: 'admin_usuarios', event: 'rol_cambiado', ip, admin: decoded.uid, uid, rol })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'admin_usuarios', event: 'rol_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
