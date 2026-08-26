// ============================================================
// POST /api/grupos-personalizados/unirse
// Modalidades personales "por persona" (pareja/familia/reducido): quien
// compra el plan queda como jefe con un código de 6 caracteres — esta
// ruta deja que hasta `personasMax` personas se unan GRATIS con ese
// código (el jefe ya pagó por todo el grupo). Si el jefe ya tiene una
// franja aceptada con clases futuras generadas, se agrega al nuevo
// miembro a esas clases (best-effort, fuera de la transacción — mismo
// patrón que extenderClasesPersonalizadas en lib/firestore.ts).
// Body: { codigo }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'

export const runtime = 'nodejs'

const CODIGO_RE = /^[A-Z0-9]{6}$/

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'grupos-personalizados:unirse', { max: 10, windowMs: 60_000 })
  if (limited) {
    log.warn({ scope: 'grupos_personalizados', event: 'rate_limited', action: 'unirse', ip })
    return limited
  }

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const uid = decoded.uid
    const db = getAdminDb()

    const body = await req.json().catch(() => null) as { codigo?: string } | null
    const codigo = body?.codigo?.trim().toUpperCase()
    if (!codigo || !CODIGO_RE.test(codigo)) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
    }

    const resultado = await db.runTransaction(async (tx) => {
      const usuarioRef = db.collection('usuarios').doc(uid)
      const grupoRef = db.collection('grupos_personalizados').doc(codigo)
      const [usuarioSnap, grupoSnap] = await Promise.all([tx.get(usuarioRef), tx.get(grupoRef)])

      if (!usuarioSnap.exists) return { error: 'Usuario no encontrado', status: 404 }
      const usuario = usuarioSnap.data()!
      if (usuario.rol !== 'estudiante') return { error: 'Solo estudiantes pueden unirse a un plan', status: 403 }
      if (usuario.activo === false) return { error: 'Tu cuenta está suspendida', status: 403 }

      const susc = usuario.suscripcionActiva
      if (susc && susc.estado === 'activa' && susc.fechaVencimiento > Date.now()) {
        return { error: 'Ya tienes un plan activo', status: 409 }
      }

      if (!grupoSnap.exists) return { error: 'Código inválido' as const, status: 404 }
      const grupo = grupoSnap.data()!
      if (grupo.estado !== 'activo' || grupo.fechaVencimiento <= Date.now()) {
        return { error: 'Este código ya venció', status: 410 }
      }

      const miembros: Array<{ uid: string; nombre: string }> = grupo.miembros ?? []
      if (miembros.some((m) => m.uid === uid)) {
        return { error: 'Ya perteneces a este grupo', status: 409 }
      }
      if (miembros.length >= grupo.personasMax) {
        return { error: 'Este grupo ya está lleno', status: 409 }
      }

      const jefeSuscSnap = await tx.get(db.collection('suscripciones').doc(grupo.suscripcionId))
      const jefeSusc = jefeSuscSnap.exists ? jefeSuscSnap.data()! : null

      const nombre = `${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim() || 'Alumno'
      const now = Date.now()

      tx.update(grupoRef, {
        miembros: [...miembros, { uid, nombre }],
        miembrosIds: FieldValue.arrayUnion(uid),
        actualizadoEn: now,
      })

      const suscRef = db.collection('suscripciones').doc()
      const sesionesCompradas = jefeSusc?.sesiones_compradas ?? 0
      tx.set(suscRef, {
        suscripcionId: suscRef.id,
        usuarioId: uid,
        planId: jefeSusc?.planId ?? '',
        nombre_plan: jefeSusc?.nombre_plan ?? 'Plan personalizado',
        sesiones_compradas: sesionesCompradas,
        sesiones_restantes: sesionesCompradas,
        fecha_compra: now,
        fecha_vencimiento: grupo.fechaVencimiento,
        estado: 'activa',
        seleccion: jefeSusc?.seleccion ?? null,
        monto_pagado: 0,
        grupoId: codigo,
        creadoEn: now,
      })

      tx.update(usuarioRef, {
        suscripcionActiva: {
          suscripcionId: suscRef.id,
          planId: jefeSusc?.planId ?? '',
          nombrePlan: jefeSusc?.nombre_plan ?? 'Plan personalizado',
          sesionesRestantes: sesionesCompradas,
          sesionesCompradas,
          fechaVencimiento: grupo.fechaVencimiento,
          estado: 'activa',
          tipo: 'personal',
          personalId: grupo.personalId,
          personas: grupo.personasMax,
          week: jefeSusc?.seleccion?.week ?? null,
          grupoId: codigo,
          esJefeGrupo: false,
        },
      })

      return { ok: true as const }
    })

    if ('error' in resultado) {
      log.info({ scope: 'grupos_personalizados', event: 'unirse_rechazado', ip, uid, codigo, motivo: resultado.error })
      return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
    }

    log.info({ scope: 'grupos_personalizados', event: 'unido', ip, uid, codigo })

    // Best-effort: si el jefe ya tiene franja aceptada con clases futuras
    // generadas, sumar al nuevo miembro ahí también. No debe tumbar la
    // respuesta de éxito si falla — el join ya se hizo.
    inscribirEnClasesFuturas(db, codigo, uid).catch((err) => {
      console.error('[unirse] no se pudo inscribir en clases futuras', err)
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'grupos_personalizados', event: 'unirse_error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

async function inscribirEnClasesFuturas(
  db: ReturnType<typeof getAdminDb>,
  grupoId: string,
  uid: string,
): Promise<void> {
  const solSnap = await db.collection('solicitudes_personalizadas')
    .where('grupoId', '==', grupoId)
    .where('estado', '==', 'aceptada')
    .orderBy('respondidoEn', 'desc')
    .limit(1)
    .get()
  if (solSnap.empty) return
  const sol = solSnap.docs[0].data()
  const clasesGeneradas: string[] = sol.clasesGeneradas ?? []
  if (clasesGeneradas.length === 0) return

  const ahora = Date.now()
  const clasesSnaps = await Promise.all(
    clasesGeneradas.map((id) => db.collection('clases').doc(id).get()),
  )
  const batch = db.batch()
  let hayCambios = false
  for (const snap of clasesSnaps) {
    if (!snap.exists) continue
    const c = snap.data()!
    if (c.estado === 'cancelada') continue
    if (c.fecha_hora_inicio < ahora) continue
    if ((c.estudiantes_inscritos ?? []).includes(uid)) continue
    batch.update(snap.ref, { estudiantes_inscritos: FieldValue.arrayUnion(uid) })
    hayCambios = true
  }
  if (hayCambios) await batch.commit()
}
