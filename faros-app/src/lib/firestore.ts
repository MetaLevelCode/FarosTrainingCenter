// ============================================================
// FAROS — Firestore helpers
// Carga diferida del SDK (mismo patrón que lib/firebase.ts).
// Todos los helpers son async y usan getFirebase() internamente.
// ============================================================

import { getFirebase } from './firebase'
import type {
  Usuario, Catalogo, Plan, Suscripcion, Transaccion,
  Clase, Asistencia, Movimiento, Categoria, UserRole, CodigoInvitacion,
} from './types'

// ── Utilidades internas ──────────────────────────────────────

function docToId<T extends object>(snap: any): T {
  return { id: snap.id, ...snap.data() } as T
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

export async function aprobarTransaccion(
  transaccionId: string,
  adminUid: string,
  planId: string,
  usuarioId: string,
): Promise<void> {
  const [{ db }, { doc, updateDoc, addDoc, collection, runTransaction, serverTimestamp }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])

  const plan = await getPlan(planId)
  if (!plan) throw new Error('Plan no encontrado')

  await runTransaction(db, async (tx) => {
    const now = Date.now()
    const fechaVencimiento = now + plan.duracion_dias * 86_400_000

    // 1. Crear suscripción
    const suscRef = doc(collection(db, 'suscripciones'))
    tx.set(suscRef, {
      suscripcionId: suscRef.id,
      usuarioId,
      planId,
      nombre_plan: plan.nombre,
      sesiones_compradas: plan.sesiones_incluidas,
      sesiones_restantes: plan.sesiones_incluidas,
      fecha_compra: now,
      fecha_vencimiento: fechaVencimiento,
      estado: 'activa',
      creadoEn: now,
    })

    // 2. Actualizar transacción
    tx.update(doc(db, 'transacciones', transaccionId), {
      estado: 'aprobada',
      fecha_revision: now,
      adminQueAprobo: adminUid,
      suscripcionCreada: { suscripcionId: suscRef.id, fechaActivacion: now },
    })

    // 3. Actualizar usuario.suscripcionActiva
    tx.update(doc(db, 'usuarios', usuarioId), {
      suscripcionActiva: {
        suscripcionId: suscRef.id,
        planId,
        nombrePlan: plan.nombre,
        sesionesRestantes: plan.sesiones_incluidas,
        fechaVencimiento: fechaVencimiento,
        estado: 'activa',
      },
    })

    // 4. Crear movimiento de ingreso
    const movRef = doc(collection(db, 'movimientos'))
    tx.set(movRef, {
      movimientoId: movRef.id,
      tipo: 'ingreso',
      monto: plan.precio_total,
      categoriaId: 'planes',
      categoriaNombre: 'Planes',
      descripcion: `${plan.nombre} — aprobación`,
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

export async function registrarAsistencia(
  claseId: string,
  usuarioId: string,
  asistio: boolean,
  profesorId: string,
): Promise<void> {
  const [{ db }, { doc, collection, addDoc, updateDoc, runTransaction, query, where, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])

  await runTransaction(db, async (tx) => {
    const now = Date.now()

    // Verificar si ya existe registro
    const q = query(
      collection(db, 'asistencias'),
      where('claseId', '==', claseId),
      where('usuarioId', '==', usuarioId),
    )
    const existing = await getDocs(q)

    if (!existing.empty) {
      // Actualizar existente
      tx.update(existing.docs[0].ref, { asistio, fecha_registro: now })
    } else {
      // Crear nuevo
      const ref = doc(collection(db, 'asistencias'))
      tx.set(ref, {
        asistenciaId: ref.id,
        claseId, usuarioId, asistio,
        fecha_registro: now,
        registradoPor: profesorId,
        creadoEn: now,
      })
    }

    if (asistio) {
      // Restar sesión de suscripción del usuario
      const usuRef = doc(db, 'usuarios', usuarioId)
      const usuSnap = await tx.get(usuRef)
      const usu = usuSnap.data() as Record<string, any> | undefined
      const sesionesRestantes: number = usu?.suscripcionActiva?.sesionesRestantes ?? 0
      if (usu && sesionesRestantes > 0) {
        const restantes = sesionesRestantes - 1
        const nuevoEstado = restantes === 0 ? 'vencida' : 'activa'
        tx.update(usuRef, {
          'suscripcionActiva.sesionesRestantes': restantes,
          'suscripcionActiva.estado': nuevoEstado,
          'estadisticas.clasesAsistidas': ((usu.estadisticas?.clasesAsistidas as number) ?? 0) + 1,
        })
        const suscId: string = usu.suscripcionActiva?.suscripcionId ?? ''
        if (suscId) {
          const suscRef = doc(db, 'suscripciones', suscId)
          tx.update(suscRef, { sesiones_restantes: restantes, estado: nuevoEstado })
        }
      }
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
  const [{ db }, { collection, addDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const ref = await addDoc(collection(db, 'movimientos'), {
    ...data,
    movimientoId: '',
    creadoEn: Date.now(),
  })
  // Escribimos el id generado en el documento
  const [, { doc, updateDoc }] = await Promise.all([Promise.resolve(), import('firebase/firestore')])
  await updateDoc(ref, { movimientoId: ref.id })
}

// ── planes CRUD ──────────────────────────────────────────────

export async function crearPlan(data: Omit<Plan, 'id' | 'planId' | 'creadoEn'>): Promise<string> {
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
  data: Partial<Omit<Plan, 'id' | 'planId' | 'creadoEn'>>,
): Promise<void> {
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await updateDoc(doc(db, 'planes', planId), data as any)
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
