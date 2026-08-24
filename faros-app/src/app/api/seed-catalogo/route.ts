// ============================================================
// POST /api/seed-catalogo
// Pobla las colecciones sedes, grupos y el doc tarifas/actual con
// los valores acordados. Idempotente — si ya existen, sobrescribe
// (útil cuando cambian precios y quieres re-seedear).
// Solo accesible por admins.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { log } from '@/lib/logger'
import { clientIp } from '@/lib/ratelimit'

export const runtime = 'nodejs'

// ── Sedes ─────────────────────────────────────────────────
const SEDES = [
  {
    id: 'utp',
    codigo: 'UTP',
    nombre: 'UTP',
    direccion: 'Universidad Tecnológica de Pereira',
    activo: true,
    orden: 1,
  },
  {
    id: 'tulcan',
    codigo: 'TULCAN',
    nombre: 'Tulcán II',
    activo: true,
    orden: 2,
  },
] as const

// ── Grupos grupales ───────────────────────────────────────
const GRUPOS = [
  {
    id: 'estrellas-utp',
    nombre: 'Estrellas UTP',
    sedeCodigo: 'UTP',
    horarios: ['Lun · 6:00 PM', 'Mié · 6:00 PM', 'Sáb · 10:00 AM'],
    nivel: 'Principiantes',
    coach: 'Coach Felipe Cárdenas',
    cupoMaximo: 12,
    disponible: true,
  },
  {
    id: 'knowill-vip',
    nombre: 'Knowill VIP (Tiburones)',
    sedeCodigo: 'UTP',
    horarios: ['Mar · 6:00 PM', 'Jue · 6:00 PM', 'Sáb · 2:00 PM'],
    nivel: 'Intermedio – avanzado',
    coach: 'Coach Ana Torres',
    cupoMaximo: 10,
    disponible: true,
  },
  {
    id: 'tulcan-ii',
    nombre: 'Tulcán II',
    sedeCodigo: 'TULCAN',
    horarios: ['Mié · 6:00 PM', 'Vie · 6:00 PM'],
    nivel: 'Todos los niveles',
    coach: 'Coach Marcos Ruiz',
    cupoMaximo: 12,
    disponible: true,
  },
] as const

// ── Tarifas ───────────────────────────────────────────────
const TARIFAS_ACTUAL = {
  version: 1,
  grupoPorSesion: { 1: 15_000, 2: 12_000, 3: 10_000 },
  personales: {
    // N.P — Natación Personalizada
    individual: {
      categoria: 'NP', porPersona: false, personasMin: 1, personasMax: 1,
      precios: { 4: 150_000, 8: 280_000, 12: 390_000 },
    },
    pareja: {
      categoria: 'NP', porPersona: true, personasMin: 2, personasMax: 2,
      precios: { 4: 115_000, 8: 200_000, 12: 250_000 },
    },
    familia: {
      categoria: 'NP', porPersona: true, personasMin: 3, personasMax: 5,
      precios: { 4: 110_000, 8: 190_000, 12: 240_000 },
    },
    reducido: {
      categoria: 'NP', porPersona: true, personasMin: 3, personasMax: 5,
      precios: { 4: 80_000, 8: 140_000, 12: 190_000 },
    },
    // A.F.P — Acondicionamiento Físico Personalizado
    funcional: {
      categoria: 'AFP', porPersona: false, personasMin: 1, personasMax: 1,
      precios: { 4: 200_000, 8: 376_000, 12: 480_000 },
    },
  },
  conjuntos: {
    'nat-acuagym':   { precios: { 1: 290_000, 2: 480_000 } },
    'funcional':     { precios: { 1: 280_000, 2: 560_000 } },
    'rumba':         { precios: { 1: null,    2: null } },
  },
  vacacionesPorNino: 150_000,
  virtualPorMes: 120_000,
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

    const now = Date.now()
    const batch = db.batch()

    for (const { id, ...s } of SEDES) {
      batch.set(db.collection('sedes').doc(id), { ...s, creadoEn: now, actualizadoEn: now })
    }
    for (const { id, ...g } of GRUPOS) {
      batch.set(db.collection('grupos').doc(id), { ...g, creadoEn: now, actualizadoEn: now })
    }
    batch.set(db.collection('tarifas').doc('actual'), {
      ...TARIFAS_ACTUAL,
      actualizadoEn: now,
      actualizadoPor: decoded.uid,
    })

    await batch.commit()

    log.info({ scope: 'seed-catalogo', event: 'ok', ip, uid: decoded.uid,
      sedes: SEDES.length, grupos: GRUPOS.length })
    return NextResponse.json({
      ok: true,
      sedes: SEDES.length,
      grupos: GRUPOS.length,
      tarifas: 'actual',
    })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    log.error({ scope: 'seed-catalogo', event: 'internal_error', ip, err })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
