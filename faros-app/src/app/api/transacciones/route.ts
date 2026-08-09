// ============================================================
// POST /api/transacciones
// Crea una solicitud de plan en Firestore usando Admin SDK.
// El precio se calcula en el servidor — el cliente nunca declara el monto.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { calcularPrecio, resumenPlan } from '@/lib/planes'
import type { SeleccionPlan } from '@/lib/planes'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })
    }

    const decoded = await getAdminAuth().verifyIdToken(token)
    const uid = decoded.uid

    const body = await req.json() as { seleccion: SeleccionPlan }
    if (!body?.seleccion?.tipo) {
      return NextResponse.json({ error: 'Selección inválida' }, { status: 400 })
    }
    const { seleccion } = body

    const db = getAdminDb()
    const userSnap = await db.collection('usuarios').doc(uid).get()
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }
    const u = userSnap.data()!
    if (u.rol !== 'estudiante') {
      return NextResponse.json({ error: 'Solo estudiantes pueden solicitar planes' }, { status: 403 })
    }
    if (u.activo === false) {
      return NextResponse.json({ error: 'Tu cuenta está suspendida' }, { status: 403 })
    }

    const precio = calcularPrecio(seleccion)
    const resumen = resumenPlan(seleccion)
    const now = Date.now()

    const ref = db.collection('transacciones').doc()
    await ref.set({
      transaccionId: ref.id,
      usuarioId: uid,
      nombre_usuario: `${u.nombres} ${u.apellidos}`,
      seleccion,
      nombre_plan: resumen.titulo,
      planId: '',
      monto: precio.disponible ? precio.total : 0,
      monto_disponible: precio.disponible,
      estado: 'pendiente',
      comprobante_url: null,
      fecha_solicitud: now,
      creadoEn: now,
    })

    return NextResponse.json({ transaccionId: ref.id })
  } catch (err: any) {
    const code: string = err?.code ?? ''
    if (code.startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    console.error('[POST /api/transacciones]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
