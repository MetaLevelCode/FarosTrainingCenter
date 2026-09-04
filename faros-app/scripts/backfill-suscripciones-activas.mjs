// ============================================================
// One-off: reconstruye usuarios/{uid}.suscripcionesActivas (mapa por
// suscripcionId, soporta VARIOS planes activos a la vez — ej. natación
// personalizada + actividad física) desde la colección suscripciones/,
// la fuente de verdad — nunca afectada por el bug de aprobarTransaccion()
// que sobrescribía el campo legacy suscripcionActiva (un solo plan) cada
// vez que se aprobaba una transacción nueva.
//
// Candidatos: todo usuario con suscripcionActiva != null (legacy), UNIDO
// con todo usuario que tenga algún doc en suscripciones con
// estado=='activa' (puede tener más de una — ese es justo el caso que
// este script repara). Para cada uno, se reconstruye el mapa SOLO con
// las suscripciones estado=='activa' && fecha_vencimiento > ahora (una
// suscripcionActiva legacy apuntando a algo ya vencido en la práctica
// pero nunca barrido a 'vencida' NO se arrastra — limpieza deliberada
// del caché, no solo migración).
//
// Después de reconstruir, borra el campo legacy suscripcionActiva del
// usuario (FieldValue.delete()) — Release 1 del refactor ya escribe en
// ambos campos (dual-write), así que este backfill solo necesita cubrir
// usuarios/transacciones aprobadas ANTES de ese deploy.
//
// Uso (Node 20.6+):
//   node --env-file=.env.local scripts/backfill-suscripciones-activas.mjs
//
// Si tu Node es más viejo, exporta FIREBASE_SERVICE_ACCOUNT_KEY a mano
// antes de correr el script (mismo valor que .env.local).
//
// IMPORTANTE: correr solo DESPUÉS de desplegar Release 1 (firestore.rules
// + el dual-write en aprobarTransaccion()/unirse), nunca antes — de lo
// contrario el campo suscripcionesActivas quedaría sin la protección de
// las reglas mientras existe, y cualquier aprobación en el ínterin no
// quedaría reflejada en el mapa reconstruido acá.
// ============================================================

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
const app = initializeApp(
  key ? { credential: cert(JSON.parse(key)) } : { credential: applicationDefault() },
)
const db = getFirestore(app)

const ahora = Date.now()
const CHUNK = 400 // margen bajo el límite de 500 writes/batch de Firestore

// ── 1. Candidatos: usuarios con suscripcionActiva legacy, o con algún
//    doc activo en suscripciones/ ──────────────────────────────────
const [usuariosConLegacySnap, suscripcionesActivasSnap] = await Promise.all([
  db.collection('usuarios').where('suscripcionActiva', '!=', null).get(),
  db.collection('suscripciones').where('estado', '==', 'activa').get(),
])

const candidatoIds = new Set(usuariosConLegacySnap.docs.map((d) => d.id))
const suscripcionesPorUsuario = new Map() // usuarioId -> [suscripcionDoc, ...]
for (const doc of suscripcionesActivasSnap.docs) {
  const s = doc.data()
  if (!s.usuarioId) continue
  if (s.fecha_vencimiento == null || s.fecha_vencimiento <= ahora) continue // vencida en la práctica, no se arrastra
  candidatoIds.add(s.usuarioId)
  if (!suscripcionesPorUsuario.has(s.usuarioId)) suscripcionesPorUsuario.set(s.usuarioId, [])
  suscripcionesPorUsuario.get(s.usuarioId).push({ id: doc.id, ...s })
}

console.log(`Candidatos a migrar: ${candidatoIds.size} usuarios.`)

// ── 2. Cache de grupos_personalizados (para resolver esJefeGrupo) ──
const grupoCache = new Map() // grupoId -> jefeId | null
async function jefeDeGrupo(grupoId) {
  if (!grupoId) return null
  if (grupoCache.has(grupoId)) return grupoCache.get(grupoId)
  const snap = await db.collection('grupos_personalizados').doc(grupoId).get()
  const jefeId = snap.exists ? (snap.data().jefeId ?? null) : null
  grupoCache.set(grupoId, jefeId)
  return jefeId
}

// ── 3. Reconstruir el mapa suscripcionesActivas por usuario ────────
const updates = [] // { uid, suscripcionesActivas }
let advertencias = 0

for (const usuarioId of candidatoIds) {
  const docs = suscripcionesPorUsuario.get(usuarioId) ?? []
  const mapa = {}
  const vistos = [] // { key, suscripcionId } para detectar sub-modalidad duplicada

  for (const s of docs) {
    const sel = s.seleccion ?? {}
    const tipo = sel.tipo ?? null
    const esPersonal = tipo === 'personal'
    const esVacaciones = tipo === 'vacaciones'
    const grupoId = s.grupoId ?? null
    const jefeId = grupoId ? await jefeDeGrupo(grupoId) : null

    const entrada = {
      suscripcionId: s.id,
      planId: s.planId ?? '',
      nombrePlan: s.nombre_plan ?? '',
      sesionesRestantes: s.sesiones_restantes ?? 0,
      sesionesCompradas: s.sesiones_compradas ?? 0,
      fechaVencimiento: s.fecha_vencimiento,
      estado: 'activa',
      tipo: tipo ?? undefined,
      combinacionId: esPersonal ? (sel.combinacionId ?? null) : null,
      personalId: esPersonal ? (sel.personalId ?? null) : null,
      personas: esPersonal ? (sel.personas ?? null) : null,
      week: esPersonal ? (sel.week ?? null) : null,
      ninos: esVacaciones ? (sel.ninos ?? null) : null,
      grupoId,
      esJefeGrupo: grupoId != null && jefeId === usuarioId,
    }

    const claveSubModalidad = esPersonal
      ? `personal:${entrada.personalId}:${entrada.combinacionId}`
      : `${tipo}`
    const dup = vistos.find((v) => v.key === claveSubModalidad)
    if (dup) {
      console.warn(`[ADVERTENCIA] usuario ${usuarioId}: dos suscripciones activas de la misma sub-modalidad (${claveSubModalidad}) — ${dup.suscripcionId} y ${s.id}. Se conservan ambas, revisar a mano.`)
      advertencias++
    }
    vistos.push({ key: claveSubModalidad, suscripcionId: s.id })

    mapa[s.id] = entrada
  }

  updates.push({ uid: usuarioId, suscripcionesActivas: mapa })
}

// ── 4. Escribir en chunks de CHUNK usuarios por batch ───────────────
let migrados = 0
for (let i = 0; i < updates.length; i += CHUNK) {
  const chunk = updates.slice(i, i + CHUNK)
  const batch = db.batch()
  for (const { uid, suscripcionesActivas } of chunk) {
    batch.update(db.collection('usuarios').doc(uid), {
      suscripcionesActivas,
      suscripcionActiva: FieldValue.delete(),
    })
  }
  await batch.commit()
  migrados += chunk.length
  console.log(`Migrados ${migrados}/${updates.length} usuarios...`)
}

console.log(`Listo. ${migrados} usuarios migrados, ${advertencias} advertencias de sub-modalidad duplicada.`)
