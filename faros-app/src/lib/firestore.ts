// ============================================================
// FAROS — Firestore helpers
// Carga diferida del SDK (mismo patrón que lib/firebase.ts).
// Todos los helpers son async y usan getFirebase() internamente.
// ============================================================

import { getFirebase } from './firebase'
import type {
  Usuario, Catalogo, Plan, Suscripcion, Transaccion,
  Clase, Asistencia, Movimiento, Categoria, UserRole, CodigoInvitacion,
  Sede, Grupo, Tarifas,
} from './types'

// ── Utilidades internas ──────────────────────────────────────

function docToId<T extends object>(snap: any): T {
  // snap.id (el path real del doc) siempre debe ganar sobre cualquier
  // campo `id` guardado dentro de los datos — por eso va al final del spread.
  return { ...snap.data(), id: snap.id } as T
}

// ── usuarios ─────────────────────────────────────────────────

export async function getUsuario(uid: string): Promise<Usuario | null> {
  const [{ db }, { doc, getDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDoc(doc(db, 'usuarios', uid))
  return snap.exists() ? docToId<Usuario>(snap) : null
}

export async function getUsuarios(filtroRol?: UserRole): Promise<Usuario[]> {
  const [{ db }, { collection, query, where, getDocs, orderBy }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const col = collection(db, 'usuarios')
  const q = filtroRol
    ? query(col, where('rol', '==', filtroRol), orderBy('apellidos'))
    : query(col, orderBy('apellidos'))
  const snap = await getDocs(q)
  return snap.docs.map(docToId<Usuario>)
}

export async function setUsuarioActivo(uid: string, activo: boolean): Promise<void> {
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  // Guardamos estado en un campo `activo` booleano
  await updateDoc(doc(db, 'usuarios', uid), { activo })
}

// ── catalogo ─────────────────────────────────────────────────

export async function getCatalogo(): Promise<Catalogo[]> {
  const [{ db }, { collection, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDocs(collection(db, 'catalogo'))
  return snap.docs.map(docToId<Catalogo>)
}

// ── planes ───────────────────────────────────────────────────

export async function getPlanes(soloActivos = true): Promise<Plan[]> {
  const [{ db }, { collection, query, where, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const col = collection(db, 'planes')
  const q = soloActivos ? query(col, where('estado', '==', true)) : query(col)
  const snap = await getDocs(q)
  return snap.docs.map(docToId<Plan>)
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const [{ db }, { doc, getDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDoc(doc(db, 'planes', planId))
  return snap.exists() ? docToId<Plan>(snap) : null
}

// ── suscripciones ────────────────────────────────────────────

export async function getSuscripcionesUsuario(usuarioId: string): Promise<Suscripcion[]> {
  const [{ db }, { collection, query, where, getDocs, orderBy }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const q = query(
    collection(db, 'suscripciones'),
    where('usuarioId', '==', usuarioId),
    orderBy('creadoEn', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(docToId<Suscripcion>)
}

// ── transacciones ────────────────────────────────────────────

export async function getTransacciones(estado?: Transaccion['estado']): Promise<Transaccion[]> {
  const [{ db }, { collection, query, where, getDocs, orderBy }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const col = collection(db, 'transacciones')
  const q = estado
    ? query(col, where('estado', '==', estado), orderBy('creadoEn', 'desc'))
    : query(col, orderBy('creadoEn', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(docToId<Transaccion>)
}

/**
 * Aprueba una transacción usando el precio y la selección CONGELADOS
 * en la propia tx (lo que vio el alumno en el wizard). Ya no depende
 * de la colección planes/ — el admin no elige plantilla.
 *
 * Opcionalmente el admin puede overridear el monto (descuento acordado).
 */
export async function aprobarTransaccion(
  transaccionId: string,
  adminUid: string,
  opts?: { montoOverride?: number },
): Promise<void> {
  const [{ db }, { doc, collection, runTransaction }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const { sesionesDelPlan, duracionDiasDelPlan, resumenPlan } = await import('./planes')

  await runTransaction(db, async (tx) => {
    const txRef = doc(db, 'transacciones', transaccionId)
    const txSnap = await tx.get(txRef)
    if (!txSnap.exists()) throw new Error('Transacción no encontrada')
    const t = txSnap.data() as Transaccion
    if (t.estado !== 'pendiente') throw new Error('La transacción ya fue procesada')
    if (!t.seleccion) throw new Error('La transacción no tiene selección de plan')

    const sel = t.seleccion
    const now = Date.now()
    const sesiones = sesionesDelPlan(sel)
    const dias = duracionDiasDelPlan(sel)
    const fechaVencimiento = now + dias * 86_400_000
    const monto = Number.isFinite(opts?.montoOverride) ? (opts!.montoOverride as number) : t.monto
    const resumen = resumenPlan(sel)
    const nombrePlan = t.nombre_plan ?? resumen.titulo

    // 1. Crear suscripción
    const suscRef = doc(collection(db, 'suscripciones'))
    tx.set(suscRef, {
      suscripcionId: suscRef.id,
      usuarioId: t.usuarioId,
      planId: t.planId ?? '',
      nombre_plan: nombrePlan,
      sesiones_compradas: sesiones,
      sesiones_restantes: sesiones,
      fecha_compra: now,
      fecha_vencimiento: fechaVencimiento,
      estado: 'activa',
      seleccion: sel,
      monto_pagado: monto,
      creadoEn: now,
    })

    // 2. Actualizar transacción
    tx.update(txRef, {
      estado: 'aprobada',
      fecha_revision: now,
      adminQueAprobo: adminUid,
      monto,  // registra el monto real (útil si hubo override)
      suscripcionCreada: { suscripcionId: suscRef.id, fechaActivacion: now },
    })

    // 3. Actualizar usuario.suscripcionActiva
    tx.update(doc(db, 'usuarios', t.usuarioId), {
      suscripcionActiva: {
        suscripcionId: suscRef.id,
        planId: t.planId ?? '',
        nombrePlan,
        sesionesRestantes: sesiones,
        sesionesCompradas: sesiones,
        fechaVencimiento,
        estado: 'activa',
      },
    })

    // 4. Crear movimiento de ingreso
    const movRef = doc(collection(db, 'movimientos'))
    tx.set(movRef, {
      movimientoId: movRef.id,
      tipo: 'ingreso',
      monto,
      categoriaId: 'planes',
      categoriaNombre: 'Planes',
      descripcion: `${nombrePlan} — aprobación`,
      fecha: now,
      origen: 'transaccion_aprobada',
      transaccionId,
      creadoEn: now,
    })
  })
}

export async function rechazarTransaccion(
  transaccionId: string,
  adminUid: string,
  motivo: string,
): Promise<void> {
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await updateDoc(doc(db, 'transacciones', transaccionId), {
    estado: 'rechazada',
    fecha_revision: Date.now(),
    adminQueAprobo: adminUid,
    motivo_rechazo: motivo,
  })
}

// ── clases ───────────────────────────────────────────────────

export async function getClasesProfesor(instructorId: string): Promise<Clase[]> {
  const [{ db }, { collection, query, where, getDocs, orderBy }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const q = query(
    collection(db, 'clases'),
    where('instructor_id', '==', instructorId),
    orderBy('fecha_hora_inicio', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(docToId<Clase>)
}

export async function getClasesDisponibles(sede: string): Promise<Clase[]> {
  const [{ db }, { collection, query, where, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const q = query(
    collection(db, 'clases'),
    where('sede', '==', sede),
    where('estado', '==', 'programada'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(docToId<Clase>)
}

export async function updateObservacionesClase(claseId: string, observaciones: string): Promise<void> {
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await updateDoc(doc(db, 'clases', claseId), {
    observaciones_profesor: observaciones,
    estado: 'finalizada',
    actualizadoEn: Date.now(),
  })
}

// ── asistencias ──────────────────────────────────────────────

export async function getAsistenciasClase(claseId: string): Promise<Asistencia[]> {
  const [{ db }, { collection, query, where, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const q = query(collection(db, 'asistencias'), where('claseId', '==', claseId))
  const snap = await getDocs(q)
  return snap.docs.map(docToId<Asistencia>)
}

/**
 * Registra o corrige la asistencia del alumno a una clase.
 *
 * La delta contra el estado previo determina el ajuste:
 *   nuevo=true, previo=false|null → +1 clasesAsistidas, -1 sesionesRestantes
 *   nuevo=false, previo=true      → -1 clasesAsistidas, +1 sesionesRestantes
 *   sin cambio                    → solo actualiza timestamp
 *
 * `tasaAsistencia` se recalcula como asistidas / reservadas y se guarda
 * de forma denormalizada para que los rankings no la calculen a mano.
 */
export async function registrarAsistencia(
  claseId: string,
  usuarioId: string,
  asistio: boolean,
  profesorId: string,
): Promise<void> {
  const [{ db }, { doc, collection, runTransaction }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])

  // ID determinista permite tx.get() en lugar de una query no-transaccional
  const asistenciaRef = doc(db, 'asistencias', `${claseId}_${usuarioId}`)

  await runTransaction(db, async (tx) => {
    const now = Date.now()
    const usuRef = doc(db, 'usuarios', usuarioId)

    // Lecturas primero (regla de Firestore: todas las gets antes de writes)
    const [existingSnap, usuSnap] = await Promise.all([
      tx.get(asistenciaRef),
      tx.get(usuRef),
    ])

    const previo = existingSnap.exists() ? Boolean(existingSnap.data()!.asistio) : null
    const delta = asistio === previo ? 0 : (asistio ? 1 : -1)

    // 1. Upsert asistencia
    if (existingSnap.exists()) {
      tx.update(asistenciaRef, { asistio, fecha_registro: now })
    } else {
      tx.set(asistenciaRef, {
        asistenciaId: asistenciaRef.id,
        claseId, usuarioId, asistio,
        fecha_registro: now,
        registradoPor: profesorId,
        creadoEn: now,
      })
    }

    // 2. Ajustar estadísticas + suscripción según la delta
    if (delta === 0 || !usuSnap.exists()) return
    const usu = usuSnap.data() as Record<string, any>

    const asistidasPrev = (usu.estadisticas?.clasesAsistidas as number) ?? 0
    const reservadasPrev = (usu.estadisticas?.clasesReservadas as number) ?? 0
    const asistidas = Math.max(0, asistidasPrev + delta)
    const tasaAsistencia = reservadasPrev > 0 ? Math.min(1, asistidas / reservadasPrev) : 0

    const restantesPrev: number = usu.suscripcionActiva?.sesionesRestantes ?? 0
    const sesionesCompradas: number | undefined = usu.suscripcionActiva?.sesionesCompradas
    const cap = Number.isFinite(sesionesCompradas) ? (sesionesCompradas as number) : Number.POSITIVE_INFINITY
    // Al restar (delta=+1) no bajamos de 0; al devolver (delta=-1) no subimos del total comprado.
    const restantes = Math.max(0, Math.min(cap, restantesPrev - delta))

    const nuevoEstado = restantes === 0 ? 'vencida' : 'activa'

    const usuUpdate: Record<string, any> = {
      'estadisticas.clasesAsistidas': asistidas,
      'estadisticas.tasaAsistencia': tasaAsistencia,
    }
    // Solo tocamos suscripcionActiva si existe (no crear el campo si el user no tiene plan)
    if (usu.suscripcionActiva) {
      usuUpdate['suscripcionActiva.sesionesRestantes'] = restantes
      usuUpdate['suscripcionActiva.estado'] = nuevoEstado
    }
    tx.update(usuRef, usuUpdate)

    const suscId: string = usu.suscripcionActiva?.suscripcionId ?? ''
    if (suscId) {
      const suscRef = doc(db, 'suscripciones', suscId)
      tx.update(suscRef, { sesiones_restantes: restantes, estado: nuevoEstado })
    }
  })
}

export async function getTransaccionesUsuario(usuarioId: string): Promise<Transaccion[]> {
  const [{ db }, { collection, query, where, getDocs, orderBy }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const q = query(
    collection(db, 'transacciones'),
    where('usuarioId', '==', usuarioId),
    orderBy('creadoEn', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(docToId<Transaccion>)
}

export async function updateComprobanteTransaccion(
  transaccionId: string,
  comprobanteUrl: string,
): Promise<void> {
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await updateDoc(doc(db, 'transacciones', transaccionId), { comprobante_url: comprobanteUrl })
}

// ── movimientos ──────────────────────────────────────────────

export async function getMovimientos(limite = 50): Promise<Movimiento[]> {
  const [{ db }, { collection, query, orderBy, limit, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const q = query(collection(db, 'movimientos'), orderBy('fecha', 'desc'), limit(limite))
  const snap = await getDocs(q)
  return snap.docs.map(docToId<Movimiento>)
}

export async function addMovimiento(data: Omit<Movimiento, 'id' | 'movimientoId' | 'creadoEn'>): Promise<void> {
  const [{ db }, { collection, doc, setDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const ref = doc(collection(db, 'movimientos'))
  await setDoc(ref, {
    ...data,
    movimientoId: ref.id,
    creadoEn: Date.now(),
  })
}

// ── planes CRUD ──────────────────────────────────────────────

type PlanEditable = Omit<Plan, 'id' | 'planId' | 'creadoEn'>

/**
 * Verifica los invariantes que debe cumplir un plan antes de escribirlo.
 * Lanza Error con mensaje descriptivo si algo está mal.
 */
function validarPlan(data: Partial<PlanEditable>) {
  if ('nombre' in data) {
    if (typeof data.nombre !== 'string' || data.nombre.trim().length === 0) {
      throw new Error('El nombre del plan no puede estar vacío.')
    }
    if (data.nombre.length > 120) throw new Error('El nombre del plan es demasiado largo.')
  }
  if ('precio_total' in data) {
    if (typeof data.precio_total !== 'number' || !Number.isFinite(data.precio_total) || data.precio_total <= 0) {
      throw new Error('El precio total debe ser un número mayor a 0.')
    }
  }
  if ('sesiones_incluidas' in data) {
    if (!Number.isInteger(data.sesiones_incluidas) || (data.sesiones_incluidas as number) <= 0) {
      throw new Error('Las sesiones incluidas deben ser un entero mayor a 0.')
    }
  }
  if ('duracion_dias' in data) {
    if (!Number.isInteger(data.duracion_dias) || (data.duracion_dias as number) <= 0) {
      throw new Error('La duración en días debe ser un entero mayor a 0.')
    }
  }
  if ('catalogo_codigo' in data) {
    if (typeof data.catalogo_codigo !== 'string' || data.catalogo_codigo.trim().length === 0) {
      throw new Error('El código del catálogo es obligatorio.')
    }
  }
  if ('sede' in data) {
    if (typeof data.sede !== 'string' || data.sede.trim().length === 0) {
      throw new Error('La sede es obligatoria.')
    }
  }
}

export async function crearPlan(data: PlanEditable): Promise<string> {
  // En creación todos los campos son obligatorios; validar todo el shape
  validarPlan({
    nombre: data.nombre,
    precio_total: data.precio_total,
    sesiones_incluidas: data.sesiones_incluidas,
    duracion_dias: data.duracion_dias,
    catalogo_codigo: data.catalogo_codigo,
    sede: data.sede,
  })

  const [{ db }, { collection, doc, addDoc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const ref = await addDoc(collection(db, 'planes'), {
    ...data,
    planId: '',
    creadoEn: Date.now(),
  })
  await updateDoc(ref, { planId: ref.id })
  return ref.id
}

export async function actualizarPlan(
  planId: string,
  data: Partial<PlanEditable>,
): Promise<void> {
  validarPlan(data)
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await updateDoc(doc(db, 'planes', planId), data)
}

export const archivarPlan = (planId: string) => actualizarPlan(planId, { estado: false })

// ── usuarios rol ─────────────────────────────────────────────

export async function setUsuarioRol(uid: string, rol: UserRole): Promise<void> {
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await updateDoc(doc(db, 'usuarios', uid), { rol })
}

// ── codigos_invitacion ───────────────────────────────────────

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export async function crearCodigoInvitacion(
  adminUid: string,
  adminNombre: string,
): Promise<string> {
  const [{ db }, { doc, setDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const sufijo = Array.from(bytes).map((b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('')
  const codigo = `FAROS-COACH-${sufijo}`
  await setDoc(doc(db, 'codigos_invitacion', codigo), {
    codigo,
    creadoPor: adminNombre,
    creadoPorUid: adminUid,
    creadoEn: Date.now(),
    rol: 'profesor',
    activo: true,
    usadoPor: null,
    usadoEn: null,
  })
  return codigo
}

export async function getCodigosInvitacion(): Promise<CodigoInvitacion[]> {
  const [{ db }, { collection, getDocs, orderBy, query }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDocs(query(collection(db, 'codigos_invitacion'), orderBy('creadoEn', 'desc')))
  return snap.docs.map(docToId<CodigoInvitacion>)
}

// ── categorias ───────────────────────────────────────────────

export async function getCategorias(): Promise<Categoria[]> {
  const [{ db }, { collection, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDocs(collection(db, 'categorias'))
  return snap.docs.map(docToId<Categoria>)
}

// ── sedes ────────────────────────────────────────────────────

/**
 * Firestore SDK rechaza `undefined` (rompe con 'Cannot read properties
 * of undefined (reading M_ID)') y tampoco acepta instancias de clase con
 * métodos ni referencias circulares. `JSON.parse(JSON.stringify(x))`
 * garantiza plain data y ya de paso elimina las claves con `undefined`.
 */
function toPlainData<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/** Compat: nombre anterior por si algún caller la usaba. */
const stripUndefined = toPlainData

export async function getSedes(soloActivas = true): Promise<Sede[]> {
  const [{ db }, { collection, query, where, orderBy, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const col = collection(db, 'sedes')
  const q = soloActivas
    ? query(col, where('activo', '==', true), orderBy('orden'))
    : query(col, orderBy('orden'))
  const snap = await getDocs(q)
  return snap.docs.map(docToId<Sede>)
}

export async function upsertSede(id: string, data: Omit<Sede, 'id' | 'creadoEn' | 'actualizadoEn'>): Promise<void> {
  const [{ db }, { doc, setDoc, getDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const ref = doc(db, 'sedes', id)
  const existente = await getDoc(ref)
  const now = Date.now()
  const payload = stripUndefined({
    ...data,
    actualizadoEn: now,
    // creadoEn solo en la primera escritura
    ...(existente.exists() ? {} : { creadoEn: now }),
  })
  await setDoc(ref, payload, { merge: true })
}

export async function eliminarSede(id: string): Promise<void> {
  const [{ db }, { doc, deleteDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await deleteDoc(doc(db, 'sedes', id))
}

// ── grupos ───────────────────────────────────────────────────

export async function getGrupos(sedeCodigo?: string): Promise<Grupo[]> {
  const [{ db }, { collection, query, where, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const col = collection(db, 'grupos')
  const q = sedeCodigo ? query(col, where('sedeCodigo', '==', sedeCodigo)) : query(col)
  const snap = await getDocs(q)
  return snap.docs.map(docToId<Grupo>)
}

export async function upsertGrupo(id: string, data: Omit<Grupo, 'id' | 'creadoEn' | 'actualizadoEn'>): Promise<void> {
  const [{ db }, { doc, setDoc, getDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const ref = doc(db, 'grupos', id)
  const existente = await getDoc(ref)
  const now = Date.now()
  const payload = stripUndefined({
    ...data,
    actualizadoEn: now,
    ...(existente.exists() ? {} : { creadoEn: now }),
  })
  await setDoc(ref, payload, { merge: true })
}

export async function eliminarGrupo(id: string): Promise<void> {
  const [{ db }, { doc, deleteDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await deleteDoc(doc(db, 'grupos', id))
}

// ── tarifas ──────────────────────────────────────────────────

export async function getTarifas(): Promise<Tarifas | null> {
  const [{ db }, { doc, getDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDoc(doc(db, 'tarifas', 'actual'))
  return snap.exists() ? (snap.data() as Tarifas) : null
}

export async function actualizarTarifas(data: Omit<Tarifas, 'actualizadoEn'>, actualizadoPor?: string): Promise<void> {
  const [{ db }, { doc, setDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const payload = stripUndefined({
    ...data,
    actualizadoEn: Date.now(),
    ...(actualizadoPor ? { actualizadoPor } : {}),
  })
  await setDoc(doc(db, 'tarifas', 'actual'), payload)
}
