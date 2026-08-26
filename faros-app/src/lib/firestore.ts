// ============================================================
// FAROS — Firestore helpers
// Carga diferida del SDK (mismo patrón que lib/firebase.ts).
// Todos los helpers son async y usan getFirebase() internamente.
// ============================================================

import { getFirebase } from './firebase'
import type {
  Usuario, Catalogo, Plan, Suscripcion, Transaccion,
  Clase, Asistencia, Movimiento, Categoria, UserRole,
  Sede, Grupo, Tarifas, RutinaVirtual, SesionVirtual,
} from './types'

// ── Utilidades internas ──────────────────────────────────────

function docToId<T extends object>(snap: any): T {
  // snap.id (el path real del doc) siempre debe ganar sobre cualquier
  // campo `id` guardado dentro de los datos — por eso va al final del spread.
  return { ...snap.data(), id: snap.id } as T
}

// ── usuarios ─────────────────────────────────────────────────

/**
 * Usuario usa `uid` (no `id`) como su campo de identidad, y el whitelist
 * de creación en firestore.rules NO permite guardar `uid` dentro de los
 * datos del doc — solo vive como el path (usuarios/{uid}). docToId no lo
 * sabe (solo fija `id`), así que sin esto `uid` queda undefined para
 * TODO usuario real, y cualquier .find(x => x.uid === uid) hace match
 * con el primer usuario de la lista en vez del correcto.
 */
function docToUsuario(snap: any): Usuario {
  return { ...snap.data(), uid: snap.id } as Usuario
}

export async function getUsuario(uid: string): Promise<Usuario | null> {
  const [{ db }, { doc, getDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDoc(doc(db, 'usuarios', uid))
  return snap.exists() ? docToUsuario(snap) : null
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
  return snap.docs.map(docToUsuario)
}

export async function setUsuarioActivo(uid: string, activo: boolean): Promise<void> {
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  // Guardamos estado en un campo `activo` booleano
  await updateDoc(doc(db, 'usuarios', uid), { activo })
}

/** Guarda solo el link de Storage — la imagen ya vive comprimida ahí, nunca en Firestore. */
export async function updateFotoPerfil(uid: string, url: string): Promise<void> {
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await updateDoc(doc(db, 'usuarios', uid), { foto_perfil: url })
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
// Alfabeto sin caracteres ambiguos (sin 0/O, 1/I) para códigos de grupo
// legibles al dictarlos por teléfono/whatsapp.
const ALFABETO_CODIGO_GRUPO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generarCodigoGrupo(): string {
  let codigo = ''
  for (let i = 0; i < 6; i++) {
    codigo += ALFABETO_CODIGO_GRUPO[Math.floor(Math.random() * ALFABETO_CODIGO_GRUPO.length)]
  }
  return codigo
}

export async function aprobarTransaccion(
  transaccionId: string,
  adminUid: string,
  opts?: { montoOverride?: number },
): Promise<void> {
  const [{ db }, { doc, collection, runTransaction }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const { sesionesDelPlan, duracionDiasDelPlan, resumenPlan, PERSONALES } = await import('./planes')

  let selAprobada: import('./planes').SeleccionPlan | undefined
  let usuarioIdAprobado = ''
  let fechaVencimientoNueva = 0

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

    // Lectura del profesor asignado ANTES de cualquier escritura — las
    // transacciones de Firestore exigen que todos los get() vayan primero.
    let nombreProfesorVirtual = ''
    if (sel.tipo === 'virtual' && sel.profesorVirtualId) {
      const profSnap = await tx.get(doc(db, 'usuarios', sel.profesorVirtualId))
      if (profSnap.exists()) {
        const p = profSnap.data()
        nombreProfesorVirtual = `${p.nombres ?? ''} ${p.apellidos ?? ''}`.trim()
      }
    }

    // Modalidades personales "por persona" (pareja/familia/reducido)
    // comparten un grupo con código — ver grupos_personalizados/{codigo}.
    // Toda lectura va ANTES de cualquier escritura (regla de las
    // transacciones de Firestore), por eso este bloque vive acá.
    const subPersonal = sel.tipo === 'personal' && sel.personalId
      ? PERSONALES.find((p) => p.id === sel.personalId)
      : null
    const esModalidadGrupal = !!subPersonal?.porPersona && subPersonal.personasMax > 1

    let grupoRef: ReturnType<typeof doc> | null = null
    let grupoEsNuevo = false

    if (esModalidadGrupal) {
      const usuarioSnap = await tx.get(doc(db, 'usuarios', t.usuarioId))
      const usuarioActual = usuarioSnap.exists() ? usuarioSnap.data() : null
      const grupoIdActual = usuarioActual?.suscripcionActiva?.esJefeGrupo
        ? usuarioActual.suscripcionActiva.grupoId
        : null

      // Reutiliza el grupo si ya era jefe de uno (renovación) — así no se
      // pierde a los miembros ya inscritos ni se les cambia el código.
      if (grupoIdActual) {
        const existenteRef = doc(db, 'grupos_personalizados', grupoIdActual)
        const existenteSnap = await tx.get(existenteRef)
        if (existenteSnap.exists()) grupoRef = existenteRef
      }

      if (!grupoRef) {
        // Colisión prácticamente imposible (32^6 combinaciones), pero se
        // revalida igual antes de reservar el código.
        for (let intento = 0; intento < 5; intento++) {
          const candidatoRef = doc(db, 'grupos_personalizados', generarCodigoGrupo())
          const candidatoSnap = await tx.get(candidatoRef)
          if (!candidatoSnap.exists()) {
            grupoRef = candidatoRef
            grupoEsNuevo = true
            break
          }
        }
        if (!grupoRef) throw new Error('No se pudo generar un código de grupo único, intenta de nuevo')
      }
    }

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
      grupoId: grupoRef?.id ?? null,
      creadoEn: now,
    })

    // 1b. Crear o extender el grupo compartido (pareja/familia/reducido)
    if (esModalidadGrupal && grupoRef) {
      if (grupoEsNuevo) {
        tx.set(grupoRef, {
          codigo: grupoRef.id,
          jefeId: t.usuarioId,
          personalId: sel.personalId,
          personasMax: sel.personas,
          miembros: [{ uid: t.usuarioId, nombre: t.nombre_usuario ?? '' }],
          miembrosIds: [t.usuarioId],
          suscripcionId: suscRef.id,
          fechaVencimiento,
          estado: 'activo',
          creadoEn: now,
          actualizadoEn: now,
        })
      } else {
        // Renovación: se extiende el mismo grupo sin tocar `miembros`.
        tx.update(grupoRef, {
          personalId: sel.personalId,
          personasMax: sel.personas,
          suscripcionId: suscRef.id,
          fechaVencimiento,
          estado: 'activo',
          actualizadoEn: now,
        })
      }
    }

    // 2. Actualizar transacción
    tx.update(txRef, {
      estado: 'aprobada',
      fecha_revision: now,
      adminQueAprobo: adminUid,
      monto,  // registra el monto real (útil si hubo override)
      suscripcionCreada: { suscripcionId: suscRef.id, fechaActivacion: now },
    })

    // 3. Actualizar usuario.suscripcionActiva — tipo/personalId/personas
    // denormalizados desde la selección para que el dashboard del alumno
    // sepa si su plan es personalizado sin un fetch aparte.
    tx.update(doc(db, 'usuarios', t.usuarioId), {
      suscripcionActiva: {
        suscripcionId: suscRef.id,
        planId: t.planId ?? '',
        nombrePlan,
        sesionesRestantes: sesiones,
        sesionesCompradas: sesiones,
        fechaVencimiento,
        estado: 'activa',
        tipo: sel.tipo,
        personalId: sel.tipo === 'personal' ? sel.personalId : null,
        personas: sel.tipo === 'personal' ? sel.personas : null,
        week: sel.tipo === 'personal' ? sel.week : null,
        grupoId: grupoRef?.id ?? null,
        esJefeGrupo: esModalidadGrupal,
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

    // 5. Plan Virtual: crear la rutina para que el profesor vea a su
    // alumno de inmediato en /portal/virtual, sin sesiones todavía.
    if (sel.tipo === 'virtual' && sel.profesorVirtualId) {
      const rutinaRef = doc(collection(db, 'rutinas_virtuales'))
      tx.set(rutinaRef, {
        rutinaId: rutinaRef.id,
        alumnoId: t.usuarioId,
        profesorId: sel.profesorVirtualId,
        nombre: 'Plan virtual',
        estado: 'activa',
        creadoEn: now,
        actualizadoEn: now,
        nombre_alumno: t.nombre_usuario ?? '',
        nombre_profesor: nombreProfesorVirtual,
      })
    }

    selAprobada = sel
    usuarioIdAprobado = t.usuarioId
    fechaVencimientoNueva = fechaVencimiento
  })

  // Renovación de clase personalizada: si el alumno ya tenía una franja
  // ACEPTADA, extender las clases generadas hasta la nueva fecha de
  // vencimiento — sin esto, un plan personal renovado se queda sin
  // clases futuras pese a que el alumno ya pagó. Deliberadamente NO va
  // dentro de la transacción de arriba (el SDK de cliente no permite
  // queries dentro de una transacción, solo lecturas por referencia) y
  // es best-effort: si falla, la aprobación del pago YA se hizo y no se
  // revierte — el alumno no puede perder su plan por un choque de
  // agenda que hay que resolver a mano.
  if (selAprobada?.tipo === 'personal') {
    extenderClasesPersonalizadas(usuarioIdAprobado, fechaVencimientoNueva).catch((err) => {
      console.error('[aprobarTransaccion] no se pudo extender clases personalizadas', err)
    })
  }
}

async function extenderClasesPersonalizadas(alumnoId: string, hastaTs: number): Promise<void> {
  const [{ db }, { collection, query, where, orderBy, limit, getDocs, getDoc, writeBatch, doc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const { ocurrenciasSemanales, normalizarFranjas } = await import('./recurrencia')

  const solSnap = await getDocs(
    query(
      collection(db, 'solicitudes_personalizadas'),
      where('alumnoId', '==', alumnoId),
      where('estado', '==', 'aceptada'),
      orderBy('respondidoEn', 'desc'),
      limit(1),
    ),
  )
  if (solSnap.empty) return
  const solRef = solSnap.docs[0].ref
  const sol = solSnap.docs[0].data()

  // Modalidades grupales: inscribir a TODO el grupo, no solo al jefe que
  // renovó — mismo criterio que /api/personalizadas/[id]/aceptar.
  let estudiantesInscritos = [alumnoId]
  let cupoMaximo = sol.personas ?? 1
  if (sol.grupoId) {
    const grupoSnap = await getDoc(doc(db, 'grupos_personalizados', sol.grupoId))
    if (grupoSnap.exists()) {
      const grupo = grupoSnap.data()
      estudiantesInscritos = (grupo.miembros ?? []).map((m: { uid: string }) => m.uid)
      cupoMaximo = grupo.personasMax ?? cupoMaximo
    }
  }

  const franjas = normalizarFranjas(sol)
  if (franjas.length === 0) return

  const desde = new Date(Math.max(Date.now(), sol.rangoGeneradoHasta ?? 0))
  if (desde.getTime() >= hastaTs) return

  // Anti-choque contra clases reales del profesor en el rango nuevo
  // (grupales o personalizadas de otros alumnos).
  // orderBy explícito para reutilizar el índice [instructor_id ASC,
  // fecha_hora_inicio DESC] ya existente — sin esto Firestore exige un
  // índice ASC nuevo (ver mismo fix en .../[id]/aceptar/route.ts).
  const clasesSnap = await getDocs(
    query(
      collection(db, 'clases'),
      where('instructor_id', '==', sol.profesorId),
      where('fecha_hora_inicio', '>=', desde.getTime()),
      where('fecha_hora_inicio', '<', hastaTs),
      orderBy('fecha_hora_inicio', 'desc'),
    ),
  )
  const ocupadas = clasesSnap.docs
    .map((d) => d.data())
    .filter((c) => c.estado !== 'cancelada')
    .map((c) => new Date(c.fecha_hora_inicio).getDay())
  if (franjas.some((f) => ocupadas.includes(f.dow))) {
    console.error('[extenderClasesPersonalizadas] choque de horario al renovar, no se generaron clases', { alumnoId, solId: solRef.id })
    return
  }

  const batch = writeBatch(db)
  const nuevosIds: string[] = []
  for (const f of franjas) {
    const ocurrencias = ocurrenciasSemanales(f.dow, f.horaInicio, f.horaFin, desde, hastaTs)
    for (const oc of ocurrencias) {
      const claseRef = doc(collection(db, 'clases'))
      batch.set(claseRef, {
        claseId: claseRef.id,
        catalogo_codigo: 'personalizada',
        nombre_clase: 'Clase personalizada',
        instructor_id: sol.profesorId,
        sede: '',
        fecha_hora_inicio: oc.inicio,
        fecha_hora_fin: oc.fin,
        cupo_maximo: cupoMaximo,
        estudiantes_inscritos: estudiantesInscritos,
        estado: 'programada',
        creadoEn: Date.now(),
        actualizadoEn: Date.now(),
      })
      nuevosIds.push(claseRef.id)
    }
  }
  if (nuevosIds.length === 0) return
  batch.update(solRef, {
    clasesGeneradas: [...(sol.clasesGeneradas ?? []), ...nuevosIds],
    rangoGeneradoHasta: hastaTs,
  })
  await batch.commit()
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

/** Clases (sesiones) donde el alumno está inscrito, programadas o en curso. */
export async function getClasesAlumno(uid: string): Promise<Clase[]> {
  const [{ db }, { collection, query, where, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const q = query(
    collection(db, 'clases'),
    where('estudiantes_inscritos', 'array-contains', uid),
    where('estado', 'in', ['programada', 'en_curso']),
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
  // Las personalizadas ya tienen dueño fijo — no son un cupo abierto para
  // inscripción libre (mismo criterio que dashboard/asistencia/page.tsx).
  return snap.docs.map(docToId<Clase>).filter((c) => c.catalogo_codigo !== 'personalizada')
}

export async function updateObservacionesClase(
  claseId: string, observaciones: string, instructorId: string,
): Promise<void> {
  const [{ db }, { doc, writeBatch, increment }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const batch = writeBatch(db)
  batch.update(doc(db, 'clases', claseId), {
    observaciones_profesor: observaciones,
    estado: 'finalizada',
    actualizadoEn: Date.now(),
  })
  // Acumulado histórico del profesor (perfil: "Clases dictadas").
  batch.update(doc(db, 'usuarios', instructorId), { clasesDadas: increment(1) })
  await batch.commit()
}

/** Guarda el plan de clase (lo ve el alumno). Rules ya permiten este campo. */
export async function updateClasePlan(claseId: string, plan: string[]): Promise<void> {
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await updateDoc(doc(db, 'clases', claseId), {
    plan,
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
 * La sesión ya se descontó de sesionesRestantes al inscribirse
 * (POST /api/clases/[id]/inscribir) — marcar asistencia NO vuelve a
 * tocar el saldo, solo corrige las estadísticas de asistencia:
 *   nuevo=true, previo=false|null → +1 clasesAsistidas
 *   nuevo=false, previo=true      → -1 clasesAsistidas
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
  let huboCambio = false

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
    huboCambio = true
    const usu = usuSnap.data() as Record<string, any>

    const asistidasPrev = (usu.estadisticas?.clasesAsistidas as number) ?? 0
    const reservadasPrev = (usu.estadisticas?.clasesReservadas as number) ?? 0
    const asistidas = Math.max(0, asistidasPrev + delta)
    const tasaAsistencia = reservadasPrev > 0 ? Math.min(1, asistidas / reservadasPrev) : 0

    tx.update(usuRef, {
      'estadisticas.clasesAsistidas': asistidas,
      'estadisticas.tasaAsistencia': tasaAsistencia,
    })
  })

  // Mantiene fresca la racha cacheada (ver lib/racha-server.ts) apenas
  // cambia la asistencia — best-effort: si falla (ej. sin conexión, esto
  // se llama también al reintentar la cola offline en PendienteSync), la
  // racha queda desactualizada hasta el próximo evento o hasta que
  // GET /api/ranking la recalcule de forma perezosa. Nunca debe tumbar el
  // registro de asistencia, que ya se guardó arriba.
  if (huboCambio) {
    try {
      const { getAuth } = await import('firebase/auth')
      const idToken = await getAuth().currentUser?.getIdToken()
      if (idToken) {
        await fetch('/api/racha/recalcular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ usuarioId }),
        })
      }
    } catch (err) {
      console.error('[registrarAsistencia] no se pudo refrescar la racha', err)
    }
  }
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

/**
 * Trae TODOS los movimientos desde una fecha (ms) en adelante — sin tope
 * de cantidad. A diferencia de getMovimientos(limite), que corta por
 * cantidad y puede omitir movimientos dentro de la ventana si el club
 * supera ese número, esta filtra por rango real de fecha.
 */
export async function getMovimientosDesde(desde: number): Promise<Movimiento[]> {
  const [{ db }, { collection, query, where, orderBy, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const q = query(
    collection(db, 'movimientos'),
    where('fecha', '>=', desde),
    orderBy('fecha', 'desc'),
  )
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


// ── categorias ───────────────────────────────────────────────

export async function getCategorias(): Promise<Categoria[]> {
  const [{ db }, { collection, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDocs(collection(db, 'categorias'))
  return snap.docs.map(docToId<Categoria>)
}

export async function crearCategoria(data: Omit<Categoria, 'id' | 'categoriaId'>): Promise<string> {
  if (!data.nombre?.trim()) throw new Error('El nombre de la categoría no puede estar vacío.')
  const [{ db }, { collection, doc, setDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const ref = doc(collection(db, 'categorias'))
  await setDoc(ref, { ...data, nombre: data.nombre.trim(), categoriaId: ref.id })
  return ref.id
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

// ── rutinas_virtuales (Plan Virtual) ──────────────────────────
// Normalmente la rutina se crea sola al aprobar la transacción (ver
// aprobarTransaccion()) — crearRutinaVirtual() cubre el caso de que un
// profesor/admin necesite armar una a mano.

export async function crearRutinaVirtual(data: {
  alumnoId: string; profesorId: string; nombre: string
  nombreAlumno?: string; nombreProfesor?: string
}): Promise<string> {
  const [{ db }, { collection, addDoc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const now = Date.now()
  const ref = await addDoc(collection(db, 'rutinas_virtuales'), {
    rutinaId: '',
    alumnoId: data.alumnoId,
    profesorId: data.profesorId,
    nombre: data.nombre,
    estado: 'activa',
    creadoEn: now,
    actualizadoEn: now,
    ...(data.nombreAlumno ? { nombre_alumno: data.nombreAlumno } : {}),
    ...(data.nombreProfesor ? { nombre_profesor: data.nombreProfesor } : {}),
  })
  await updateDoc(ref, { rutinaId: ref.id })
  return ref.id
}

/** Todas las rutinas (para la pestaña Virtual del admin) — sin filtrar por profesor. */
export async function getTodasRutinasVirtuales(): Promise<RutinaVirtual[]> {
  const [{ db }, { collection, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDocs(collection(db, 'rutinas_virtuales'))
  return snap.docs.map(docToId<RutinaVirtual>)
}

/** Rutinas de los alumnos asignados a un profesor (para /portal/virtual). */
export async function getRutinasProfesor(profesorId: string): Promise<RutinaVirtual[]> {
  const [{ db }, { collection, query, where, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDocs(query(collection(db, 'rutinas_virtuales'), where('profesorId', '==', profesorId)))
  return snap.docs.map(docToId<RutinaVirtual>)
}

/** Rutina activa de un alumno (para /dashboard/virtual). Null si no tiene. */
export async function getRutinaAlumno(alumnoId: string): Promise<RutinaVirtual | null> {
  const [{ db }, { collection, query, where, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDocs(query(
    collection(db, 'rutinas_virtuales'),
    where('alumnoId', '==', alumnoId),
    where('estado', '==', 'activa'),
  ))
  if (snap.empty) return null
  return docToId<RutinaVirtual>(snap.docs[0])
}

export async function getSesionesVirtuales(rutinaId: string): Promise<SesionVirtual[]> {
  const [{ db }, { collection, query, orderBy, getDocs }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const snap = await getDocs(query(collection(db, 'rutinas_virtuales', rutinaId, 'sesiones'), orderBy('orden', 'asc')))
  return snap.docs.map(docToId<SesionVirtual>)
}

/** Solo el profesor/admin dueño de la rutina puede crear/editar contenido. */
export async function crearSesionVirtual(rutinaId: string, data: {
  titulo: string; descripcion: string; videoUrl: string; orden: number
}): Promise<string> {
  const [{ db }, { collection, addDoc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  const now = Date.now()
  const ref = await addDoc(collection(db, 'rutinas_virtuales', rutinaId, 'sesiones'), {
    sesionId: '',
    titulo: data.titulo,
    descripcion: data.descripcion,
    videoUrl: data.videoUrl,
    orden: data.orden,
    completada: false,
    completadaEn: null,
    creadoEn: now,
    actualizadoEn: now,
  })
  await updateDoc(ref, { sesionId: ref.id })
  return ref.id
}

export async function actualizarSesionVirtual(rutinaId: string, sesionId: string, data: {
  titulo?: string; descripcion?: string; videoUrl?: string; orden?: number
}): Promise<void> {
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await updateDoc(doc(db, 'rutinas_virtuales', rutinaId, 'sesiones', sesionId), {
    ...data,
    actualizadoEn: Date.now(),
  })
}

export async function eliminarSesionVirtual(rutinaId: string, sesionId: string): Promise<void> {
  const [{ db }, { doc, deleteDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await deleteDoc(doc(db, 'rutinas_virtuales', rutinaId, 'sesiones', sesionId))
}

/** El alumno dueño de la rutina — únicos campos que las reglas le dejan tocar. */
export async function marcarSesionVirtual(rutinaId: string, sesionId: string, completada: boolean): Promise<void> {
  const [{ db }, { doc, updateDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await updateDoc(doc(db, 'rutinas_virtuales', rutinaId, 'sesiones', sesionId), {
    completada,
    completadaEn: completada ? Date.now() : null,
  })
}
