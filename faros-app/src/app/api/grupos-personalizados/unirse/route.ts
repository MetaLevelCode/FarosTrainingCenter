// ============================================================
// POST /api/grupos-personalizados/unirse
// Dos casos comparten esta ruta (ver GrupoPersonalizado en lib/types.ts):
//  - Personalizado "por persona" (pareja/familia/reducido): quien compra
//    el plan queda como jefe con un código de 6 caracteres — esta ruta
//    deja que hasta `personasMax` PERSONAS se unan GRATIS con ese código
//    (el jefe ya pagó por todo el grupo). Cada miembro ocupa 1 cupo.
//  - Vacaciones: el jefe eligió cuántos NIÑOS en total tiene el grupo
//    (`personasMax`); cada miembro que se une aporta su propia cantidad
//    de niños (body.ninos), no necesariamente 1 — así que el cupo se
//    calcula sumando los niños de todos los miembros, no contándolos.
// Si el jefe (Personalizado) ya tiene una franja aceptada con clases
// futuras generadas, se agrega al nuevo miembro a esas clases (best-effort,
// fuera de la transacción — mismo patrón que extenderClasesPersonalizadas
// en lib/firestore.ts). Vacaciones no tiene ese concepto de franja.
// Body: { codigo, ninos? }  — ninos solo aplica/es obligatorio si el
// grupo es de tipo 'vacaciones'.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'
import { canalGrupo } from '@/lib/mensajes'
import { tieneSubModalidad } from '@/lib/types'

export const runtime = 'nodejs'

const CODIGO_RE = /^[A-Z0-9]{6}$/

function cuposOcupados(miembros: Array<{ ninos?: number }>): number {
  return miembros.reduce((s, m) => s + (m.ninos ?? 1), 0)
}

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

    const body = await req.json().catch(() => null) as { codigo?: string; ninos?: number } | null
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

      if (!grupoSnap.exists) return { error: 'Código inválido' as const, status: 404 }
      const grupo = grupoSnap.data()!
      if (grupo.estado !== 'activo' || grupo.fechaVencimiento <= Date.now()) {
        return { error: 'Este código ya venció', status: 410 }
      }

      const esVacaciones = grupo.tipo === 'vacaciones'
      const miembros: Array<{ uid: string; nombre: string; ninos?: number }> = grupo.miembros ?? []
      if (miembros.some((m) => m.uid === uid)) {
        return { error: 'Ya perteneces a este grupo', status: 409 }
      }

      let ninosSolicitados = 1
      if (esVacaciones) {
        ninosSolicitados = Math.trunc(Number(body?.ninos))
        if (!Number.isFinite(ninosSolicitados) || ninosSolicitados < 1 || ninosSolicitados > 10) {
          return { error: 'Indica cuántos niños vas a inscribir (1-10)', status: 400 }
        }
      }

      const cuposLibres = grupo.personasMax - cuposOcupados(miembros)
      if (ninosSolicitados > cuposLibres) {
        return {
          error: esVacaciones
            ? `Solo quedan ${cuposLibres} cupo${cuposLibres === 1 ? '' : 's'} disponible${cuposLibres === 1 ? '' : 's'} en este grupo`
            : 'Este grupo ya está lleno',
          status: 409,
        }
      }

      const jefeSuscSnap = await tx.get(db.collection('suscripciones').doc(grupo.suscripcionId))
      const jefeSusc = jefeSuscSnap.exists ? jefeSuscSnap.data()! : null

      // Bloquea solo si ya tiene activa la MISMA sub-modalidad de este
      // grupo (ej. ya está en otro grupo de "Familia" natación) — no
      // cualquier plan activo, porque el usuario puede tener varios
      // planes de tipos distintos a la vez (ej. natación personalizada +
      // actividad física).
      const combinacionIdGrupo = esVacaciones ? null : (jefeSusc?.seleccion?.combinacionId ?? null)
      if (tieneSubModalidad(
        { suscripcionesActivas: usuario.suscripcionesActivas ?? (usuario.suscripcionActiva?.suscripcionId ? { [usuario.suscripcionActiva.suscripcionId]: usuario.suscripcionActiva } : {}) },
        esVacaciones
          ? { tipo: 'vacaciones' }
          : { tipo: 'personal', personalId: grupo.personalId ?? null, combinacionId: combinacionIdGrupo },
      )) {
        return { error: 'Ya tienes un plan activo de este mismo tipo', status: 409 }
      }

      const nombre = `${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim() || 'Alumno'
      const now = Date.now()

      const nuevoMiembro = esVacaciones
        ? { uid, nombre, ninos: ninosSolicitados }
        : { uid, nombre }

      tx.update(grupoRef, {
        miembros: [...miembros, nuevoMiembro],
        miembrosIds: FieldValue.arrayUnion(uid),
        actualizadoEn: now,
      })

      const suscRef = db.collection('suscripciones').doc()
      const sesionesCompradas = jefeSusc?.sesiones_compradas ?? 0
      tx.set(suscRef, {
        suscripcionId: suscRef.id,
        usuarioId: uid,
        planId: jefeSusc?.planId ?? '',
        nombre_plan: jefeSusc?.nombre_plan ?? (esVacaciones ? 'Vacaciones deportivas' : 'Plan personalizado'),
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

      // Dual-write en transición (ver aprobarTransaccion() en
      // lib/firestore.ts) — suscripcionActiva (legacy, se sobrescribe) se
      // mantiene por compatibilidad; suscripcionesActivas (mapa por
      // suscripcionId) es aditivo y no pisa otros planes activos del
      // usuario. Se retira en Release 4.
      const entradaMiembro = {
        suscripcionId: suscRef.id,
        planId: jefeSusc?.planId ?? '',
        nombrePlan: jefeSusc?.nombre_plan ?? (esVacaciones ? 'Vacaciones deportivas' : 'Plan personalizado'),
        sesionesRestantes: sesionesCompradas,
        sesionesCompradas,
        fechaVencimiento: grupo.fechaVencimiento,
        estado: 'activa',
        tipo: esVacaciones ? 'vacaciones' : 'personal',
        combinacionId: esVacaciones ? null : (jefeSusc?.seleccion?.combinacionId ?? null),
        personalId: esVacaciones ? null : grupo.personalId,
        personas: esVacaciones ? null : grupo.personasMax,
        ninos: esVacaciones ? ninosSolicitados : null,
        week: esVacaciones ? null : (jefeSusc?.seleccion?.week ?? null),
        grupoId: codigo,
        esJefeGrupo: false,
      }
      tx.update(usuarioRef, {
        suscripcionActiva: entradaMiembro,
        [`suscripcionesActivas.${suscRef.id}`]: entradaMiembro,
      })

      return { ok: true as const, esVacaciones }
    })

    if ('error' in resultado) {
      log.info({ scope: 'grupos_personalizados', event: 'unirse_rechazado', ip, uid, codigo, motivo: resultado.error })
      return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
    }

    log.info({ scope: 'grupos_personalizados', event: 'unido', ip, uid, codigo })

    // Best-effort, solo Personalizado: si el jefe ya tiene franja aceptada
    // con clases futuras generadas, sumar al nuevo miembro ahí también.
    // Vacaciones no agenda franjas. No debe tumbar la respuesta de éxito
    // si falla — el join ya se hizo.
    if (!resultado.esVacaciones) {
      inscribirEnClasesFuturas(db, codigo, uid).catch((err) => {
        console.error('[unirse] no se pudo inscribir en clases futuras', err)
      })
    }

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
  let nombreClase: string | undefined
  for (const snap of clasesSnaps) {
    if (!snap.exists) continue
    const c = snap.data()!
    if (c.estado === 'cancelada') continue
    if (c.fecha_hora_inicio < ahora) continue
    nombreClase = c.nombre_clase
    if ((c.estudiantes_inscritos ?? []).includes(uid)) continue
    batch.update(snap.ref, { estudiantes_inscritos: FieldValue.arrayUnion(uid) })
    hayCambios = true
  }
  // Muro de mensajería del grupo: sin esto, quien se une con código queda
  // inscrito en las clases pero sin permiso para leer/escribir su canal
  // (firestore.rules exige estar en `participantes`) — mismo patrón que
  // /api/clases/[id]/inscribir y /api/personalizadas/[id]/aceptar.
  if (nombreClase) {
    batch.set(db.collection('mensajes').doc(canalGrupo(nombreClase)), {
      tipo: 'grupo',
      nombre: nombreClase,
      participantes: FieldValue.arrayUnion(uid),
      actualizadoEn: ahora,
    }, { merge: true })
    hayCambios = true
  }
  if (hayCambios) await batch.commit()
}
