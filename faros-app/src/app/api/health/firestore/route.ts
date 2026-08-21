// ============================================================
// GET /api/health/firestore
// Escribe y borra un doc en debug/health para confirmar si el
// Admin SDK del servidor puede escribir a Firestore. Si esto
// devuelve ok=true pero el cliente falla, el problema NO es
// Firestore ni las rules — es el SDK cliente o la red del user.
// Requiere admin.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { log } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const db = getAdminDb()
    const adminSnap = await db.collection('usuarios').doc(decoded.uid).get()
    if (adminSnap.data()?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo admins' }, { status: 403 })
    }

    const now = Date.now()
    const ref = db.collection('debug').doc('health')

    // Write
    await ref.set({
      ts: now,
      by: decoded.uid,
      note: 'health check',
    })

    // Read back
    const snap = await ref.get()
    const readData = snap.data()

    // Cleanup
    await ref.delete()

    log.info({ scope: 'health', event: 'firestore_ok', uid: decoded.uid })

    return NextResponse.json({
      ok: true,
      wrote: { ts: now },
      read: readData,
      matched: readData?.ts === now,
      duration_ms: Date.now() - now,
    })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    log.error({ scope: 'health', event: 'firestore_fail', err })
    return NextResponse.json({
      ok: false,
      error: String(err?.message ?? err),
      code: err?.code,
    }, { status: 500 })
  }
}
