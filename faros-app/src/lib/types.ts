// ============================================================
// FAROS — Domain Types (Firestore schema)
// ============================================================

export type UserRole = 'admin' | 'profesor' | 'estudiante'

export type TipoDocumento = 'CC' | 'TI' | 'CE'

// ── usuarios/{uid} ──────────────────────────────────────────

export interface SuscripcionActiva {
  suscripcionId: string
  planId: string
  nombrePlan: string
  sesionesRestantes: number
  sesionesCompradas?: number   // se guarda en runtime desde aprobarTransaccion(); faltaba en el tipo
  fechaVencimiento: number
  estado: 'activa' | 'vencida'
  // Denormalizado desde SeleccionPlan al aprobar — permite saber si el plan
  // es personalizado sin un fetch aparte a suscripciones/{id}.
  tipo?: import('./planes').TipoPlan
  // Solo cuando tipo === 'personal' — distingue sub-modalidades que
  // comparten tipo pero son planes independientes (ej. natación
  // personalizada 'natacion' vs actividad física 'funcional', ver
  // COMBINACIONES en lib/planes.ts). Sin esto no hay forma de saber a
  // cuál de los varios planes 'personal' de un usuario corresponde esta
  // entrada dentro de Usuario.suscripcionesActivas.
  combinacionId?: string | null
  personalId?: string | null
  personas?: number
  // Frecuencia semanal del plan (1/2/3 veces por semana) — determina
  // cuántas franjas (SolicitudPersonalizada.franjas) debe elegir el alumno.
  week?: number
  // Modalidades personales "por persona" (pareja/familia/reducido) y
  // Vacaciones comparten un mismo grupo — ver grupos_personalizados/{grupoId}.
  // esJefeGrupo marca a quien compró (único que puede elegir la franja
  // horaria del grupo, en el caso de Personalizado).
  grupoId?: string | null
  esJefeGrupo?: boolean
  // Vacaciones: cuántos niños de ESTA cuenta (jefe o miembro) cubre el
  // grupo — a diferencia de `personas`, cada miembro puede aportar una
  // cantidad distinta (ver MiembroGrupo.ninos).
  ninos?: number
}

// ── Helpers de Usuario.suscripcionesActivas (múltiples planes) ──────
// Un usuario puede tener varios planes activos a la vez (ej. natación
// personalizada + actividad física, ambos tipo:'personal' pero distintos
// combinacionId) — estos helpers evitan repetir Object.values(...) y los
// criterios de comparación en cada pantalla/ruta que los consume.

/** Todas las entradas activas/vencidas del usuario, más próximas a vencer primero. */
export function listaSuscripciones(
  u: Pick<Usuario, 'suscripcionesActivas'> | null | undefined,
): SuscripcionActiva[] {
  return Object.values(u?.suscripcionesActivas ?? {}).sort((a, b) => b.fechaVencimiento - a.fechaVencimiento)
}

/** La entrada tipo:'personal' que matchea combinacionId (NP vs AFP) — o la primera si no se especifica. */
export function suscripcionPersonal(
  u: Pick<Usuario, 'suscripcionesActivas'> | null | undefined,
  combinacionId?: string | null,
): SuscripcionActiva | undefined {
  const personales = listaSuscripciones(u).filter((s) => s.tipo === 'personal')
  return combinacionId ? personales.find((s) => s.combinacionId === combinacionId) : personales[0]
}

/** Entradas ACTIVAS cuyo tipo está en la lista dada (ej. inscribir/cancelar clase: grupal|conjunto|vacaciones). */
export function suscripcionesPorTipo(
  u: Pick<Usuario, 'suscripcionesActivas'> | null | undefined,
  tipos: Array<import('./planes').TipoPlan>,
): SuscripcionActiva[] {
  return listaSuscripciones(u).filter((s) => s.tipo != null && tipos.includes(s.tipo) && s.estado === 'activa')
}

/** ¿Ya tiene una entrada activa y vigente de la MISMA sub-modalidad exacta (evita duplicar el mismo plan)? */
export function tieneSubModalidad(
  u: Pick<Usuario, 'suscripcionesActivas'> | null | undefined,
  criterio: { tipo: import('./planes').TipoPlan; personalId?: string | null; combinacionId?: string | null },
): boolean {
  return listaSuscripciones(u).some((s) =>
    s.estado === 'activa' && s.fechaVencimiento > Date.now() && s.tipo === criterio.tipo
    && (criterio.tipo !== 'personal' || (s.personalId === criterio.personalId && s.combinacionId === criterio.combinacionId)))
}

// ── Clases personalizadas (1-a-1, pareja, familia, grupo reducido) ──
// El profesor declara franjas semanales FIJAS (no cambian semana a
// semana); el alumno con plan `personal` activo elige una y manda una
// solicitud; el profesor acepta o rechaza. Al aceptar se generan las
// Clase reales (ver src/lib/recurrencia.ts + /api/personalizadas/*).

export interface FranjaDisponibilidad {
  dow: number         // 0=domingo … 6=sábado
  horaInicio: string  // 'HH:mm', 24h
  horaFin: string
}

export interface SolicitudPersonalizada {
  id: string
  solicitudId: string
  alumnoId: string
  nombreAlumno: string   // denormalizado al crear — evita N+1 reads en la bandeja del profesor
  profesorId: string
  // N franjas semanales (N = suscripcionActiva.week del alumno al pedir) —
  // todas con el mismo profesor, en días distintos. Ver lib/recurrencia.ts.
  franjas: FranjaDisponibilidad[]
  personas: number
  // De cuál de las (potencialmente varias) entradas tipo:'personal' del
  // alumno en suscripcionesActivas es esta solicitud — necesario en
  // cuanto puede tener, ej., natación personalizada Y actividad física
  // activas a la vez (ver combinacionId en SuscripcionActiva).
  suscripcionId: string
  // Denormalizado desde esa entrada .grupoId al crear la solicitud —
  // permite que /aceptar inscriba a todo el grupo sin releer la
  // suscripción del alumno.
  grupoId?: string | null
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada'
  direccion: string   // casa/conjunto donde el profesor debe ir a dar la clase
  mensaje?: string | null
  motivoRechazo?: string | null
  mensajeProfesor?: string | null   // nota opcional del profesor al aceptar
  creadoEn: number
  respondidoEn?: number | null
  clasesGeneradas?: string[]
  rangoGeneradoHasta?: number
}

export interface Estadisticas {
  clasesReservadas: number
  clasesAsistidas: number
  tasaAsistencia: number
  // Caché de la racha semanal (ver lib/racha.ts) — evita recalcularla desde
  // cero (3 lecturas: asistencias+clases+cancelaciones) en cada vista del
  // ranking. Se recalcula: (a) al registrar asistencia o cancelar a tiempo
  // — ver lib/racha-server.ts — y (b) de forma perezosa en GET /api/ranking
  // cuando rachaSemana quedó atrás de la semana actual (para capturar el
  // caso de que la racha se rompa por INACCIÓN, sin ningún evento que la
  // dispare).
  racha?: number
  rachaSemana?: number  // inicio (ms) de la semana para la que `racha` es válida
}

export interface Usuario {
  uid: string
  nombres: string
  apellidos: string
  cedula: string
  email: string
  rol: UserRole
  activo?: boolean
  telefono?: string
  telefonoEmergencia?: string
  eps?: string
  foto_perfil?: string
  sede?: string
  // Profesores
  clasesDadas?: number
  disponibilidadPersonal?: FranjaDisponibilidad[]  // franjas para clases personalizadas
  // Estudiantes
  nivel?: string
  dificultades?: string[]
  fecha_registro?: number
  estadisticas?: Estadisticas
  // LEGACY — un solo plan activo, sobrescrito en cada aprobación. En
  // transición hacia suscripcionesActivas (ver PLAN de refactor); se
  // retira una vez completada la migración (Release 4).
  suscripcionActiva?: SuscripcionActiva | null
  // Varios planes activos concurrentes, indexados por suscripcionId —
  // ver helpers listaSuscripciones/suscripcionPersonal/etc. arriba.
  suscripcionesActivas?: Record<string, SuscripcionActiva>
}

// Helper computado (no se guarda en Firestore)
export function displayName(u: Pick<Usuario, 'nombres' | 'apellidos'>): string {
  return `${u.nombres} ${u.apellidos}`.trim()
}

// ── perfiles_publicos/{uid} ──────────────────────────────────
// Subconjunto público de un profesor (usuarios/{uid}), sin PII — lectura
// abierta (sin login) para el wizard de inscripción. Sincronizado
// server-side al cambiar el rol, ver /api/admin/usuarios/[uid]/rol.
export interface PerfilPublico {
  uid: string
  nombres: string
  apellidos: string
  rol: 'profesor'
}

// Subconjunto extendido de un profesor para pantallas YA autenticadas
// (chat, selección de clase personalizada) que necesitan más que
// PerfilPublico. Servido por GET /api/profesores/publico (Admin SDK):
// las reglas de Firestore no dejan que un alumno lea usuarios/{uid} de
// otro usuario directo. Nunca cédula/teléfono/email/EPS/dificultades.
export interface ProfesorAutenticado {
  uid: string
  nombres: string
  apellidos: string
  foto_perfil?: string | null
  disponibilidadPersonal?: FranjaDisponibilidad[]
}

// ── catalogo/{codigo} ────────────────────────────────────────

export interface Catalogo {
  id: string
  codigo: string
  nombre: string
  modalidad: string
  descripcion: string
  estado: boolean
  creadoEn: number
  actualizadoEn: number
}

// ── planes/{planId} ──────────────────────────────────────────
// Plantillas nombradas que el admin puede tener guardadas (promos,
// planes ad-hoc, etc.). NO son la fuente de precios del wizard — el
// wizard usa tarifas/actual. Los campos opcionales toleran plantillas
// legacy escritas a mano en Firebase Console.

export interface Plan {
  id: string
  planId?: string             // denormalizado — no obligatorio en plantillas legacy
  nombre: string
  descripcion?: string
  catalogo_codigo?: string
  sesiones_incluidas: number
  duracion_dias?: number      // default 30 al aprobar si no está definido
  precio_total: number
  sede?: string               // legacy
  sede_aplica?: string        // alias visto en plantillas del admin
  categoria_id?: string       // referencia a categorías/{id} de movimientos (opcional)
  estado: boolean
  creadoEn?: number
  actualizadoEn?: number
}

// ── suscripciones/{suscripcionId} ────────────────────────────

export interface Suscripcion {
  id: string
  suscripcionId: string
  usuarioId: string
  planId: string
  nombre_plan: string
  sesiones_compradas: number
  sesiones_restantes: number
  fecha_compra: number
  fecha_vencimiento: number
  estado: 'activa' | 'vencida' | 'cancelada'
  creadoEn: number
  monto_pagado?: number
  // Selección congelada del wizard — permite saber, ej., a qué grupo
  // pertenece esta suscripción (para contar cupos ocupados por grupo).
  seleccion?: import('./planes').SeleccionPlan
  // Presente en modalidades personales "por persona" — ver grupos_personalizados/{grupoId}.
  grupoId?: string | null
}

// ── grupos_personalizados/{codigo} ───────────────────────────
// Dos casos usan este mismo esquema (`tipo` los distingue):
//  - Personalizado "por persona" (pareja/familia/reducido): quien compra
//    queda como jefe con un código de 6 caracteres para compartir; hasta
//    `personasMax` PERSONAS se unen gratis con ese código (ver
//    POST /api/grupos-personalizados/unirse) y quedan inscritas juntas en
//    las Clase reales que genere la solicitud del jefe (ver
//    /api/personalizadas/[id]/aceptar). Cada miembro ocupa 1 cupo.
//  - Vacaciones: quien compra elige cuántos NIÑOS en total va a tener el
//    grupo (`personasMax`); cada miembro que se une con el código aporta
//    su propia cantidad de niños (`MiembroGrupo.ninos`), no necesariamente 1.
// El ID del documento ES el código.

export interface MiembroGrupo {
  uid: string
  nombre: string  // denormalizado, evita N+1 reads al listar el grupo
  // Solo cuando el grupo es de Vacaciones — cuántos niños de este miembro
  // ocupan cupo. Ausente/1 para grupos de Personalizado (1 persona = 1 cupo).
  ninos?: number
}

export interface GrupoPersonalizado {
  id: string           // == codigo
  codigo: string
  jefeId: string
  tipo: 'personal' | 'vacaciones'
  personalId?: string | null   // 'pareja' | 'familia' | 'reducido' — solo si tipo === 'personal'
  personasMax: number          // personas (Personalizado) o niños (Vacaciones) máximos del grupo
  miembros: MiembroGrupo[]
  // Espejo plano de miembros[].uid — Firestore rules no puede hacer un
  // .map() sobre `miembros` para chequear pertenencia, así que se
  // mantiene este array en paralelo solo para el `allow read` de la regla.
  miembrosIds: string[]
  suscripcionId: string
  fechaVencimiento: number
  estado: 'activo' | 'vencido'
  creadoEn: number
  actualizadoEn: number
}

// ── transacciones/{transaccionId} ────────────────────────────

export interface SuscripcionCreada {
  suscripcionId: string
  fechaActivacion: number
}

export interface Transaccion {
  id: string
  transaccionId: string
  usuarioId: string
  planId: string
  monto: number
  monto_disponible?: boolean  // false = "tarifa por confirmar"
  comprobante_url?: string | null
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  fecha_solicitud: number
  fecha_revision?: number | null
  adminQueAprobo?: string
  motivo_rechazo?: string | null
  suscripcionCreada?: SuscripcionCreada | null
  creadoEn: number
  // Desnormalizado para mostrar sin join
  nombre_usuario?: string
  nombre_plan?: string
  // Selección del wizard guardada para que el admin sepa qué pidió el alumno
  seleccion?: import('./planes').SeleccionPlan
}

// ── clases/{claseId} ─────────────────────────────────────────

export interface Clase {
  id: string
  claseId: string
  catalogo_codigo: string
  nombre_clase: string
  instructor_id: string
  sede: string
  fecha_hora_inicio: number
  fecha_hora_fin: number
  nivel_requerimiento?: string
  cupo_maximo: number
  estudiantes_inscritos: string[]
  // De cuál suscripcionesActivas[suscripcionId] del alumno se descontó
  // su sesión al inscribirse (solo clases abiertas grupal/conjunto/
  // vacaciones — las personalizadas no pasan por /inscribir) — permite
  // que /cancelar reembolse exactamente esa misma entrada cuando el
  // alumno tiene varios planes activos a la vez.
  cargosSuscripcion?: Record<string, string>
  estado: 'programada' | 'en_curso' | 'finalizada' | 'cancelada'
  plan?: string[]
  observaciones_profesor?: string | null
  creadoEn: number
  actualizadoEn: number
  // Denormalizado desde solicitudes_personalizadas al aceptar — la clase
  // personalizada ocurre en la casa/conjunto del alumno, no en una sede fija.
  direccion?: string
  // Desnormalizado
  nombre_instructor?: string
}

// ── asistencias/{asistenciaId} ───────────────────────────────

export interface Asistencia {
  id: string
  asistenciaId: string
  claseId: string
  usuarioId: string
  asistio: boolean
  fecha_registro: number
  registradoPor: string
  creadoEn: number
}

// ── movimientos/{movimientoId} ───────────────────────────────

export type OrigenMovimiento = 'transaccion_aprobada' | 'manual'

export interface Movimiento {
  id: string
  movimientoId: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  categoriaId: string
  categoriaNombre: string
  descripcion: string
  fecha: number
  origen: OrigenMovimiento
  transaccionId?: string | null
  creadoEn: number
}

// ── categorias/{categoriaId} ─────────────────────────────────

export interface Categoria {
  id: string
  categoriaId: string
  nombre: string
  tipo: 'ingreso' | 'egreso'
  color: string
}

// ── sedes/{sedeId} ──────────────────────────────────────────
// Sede física donde se dictan clases. El código corto (UTP/TULCAN) es
// el que se guarda en usuarios.sede y grupos.sedeCodigo — evita romper
// referencias si cambia el nombre visible.

export interface Sede {
  id: string
  codigo: string         // "UTP" | "TULCAN" | ...
  nombre: string         // "UTP" | "Tulcán II"
  direccion?: string
  activo: boolean
  orden: number          // orden de aparición en selectores
  creadoEn: number
  actualizadoEn?: number
}

// ── grupos/{grupoId} ─────────────────────────────────────────
// Grupo con horario fijo. Vive en una sede. Sirve a dos wizards: "grupal"
// (natación) y "conjunto" (natación + otra disciplina) — se distinguen por
// `categoria`. Ambos comparten el mismo campo SeleccionPlan.grupoId.

export interface Grupo {
  id: string
  nombre: string
  sedeCodigo: string
  horarios: string[]     // ["Lun · 6:00 PM", "Mié · 6:00 PM"]
  nivel: string
  coach?: string
  cupoMaximo: number
  disponible: boolean
  // Ausente = 'grupal' (compatibilidad con docs creados antes de Conjuntos).
  categoria?: 'grupal' | 'conjunto'
  // Solo aplica cuando categoria === 'conjunto' — qué disciplina se combina
  // con natación (ver COMBINACIONES en lib/planes.ts, sin 'natacion').
  combinacionId?: string
  creadoEn: number
  actualizadoEn?: number
}

// ── tarifas/actual ──────────────────────────────────────────
// UN SOLO DOC. Contiene toda la matriz de precios. El wizard la lee
// para calcular el monto y lo congela en la transacción.
//
// Estructura por sesionesPorMes:
//   4  = 1x/semana × 4 semanas
//   8  = 2x/semana × 4 semanas
//   12 = 3x/semana × 4 semanas

export type CategoriaPersonal = 'NP' | 'AFP'

export interface TarifaPersonal {
  categoria: CategoriaPersonal
  porPersona: boolean
  personasMin: number
  personasMax: number
  precios: Record<number, number | null>  // { 4: 150000, 8: 280000, 12: 390000 }
}

export interface Tarifas {
  version: number
  actualizadoEn: number
  actualizadoPor?: string
  // Grupal: precio POR SESIÓN según frecuencia semanal
  grupoPorSesion: Record<number, number>  // { 1: 15000, 2: 12000, 3: 10000 }
  // Conjuntos: precio POR SESIÓN según frecuencia semanal — mismo shape que
  // grupoPorSesion, valores propios (grupo con horario fijo por sede, igual
  // que Grupal, pero combina natación con otra disciplina — ver Grupo.categoria).
  conjuntoPorSesion: Record<number, number>
  // Personales: precio mensual según sesionesPorMes. La clave es la
  // modalidad sola ('individual'|'pareja'|'familia'|'reducido') cuando la
  // combinación es 'natacion' (la de siempre), o `${combinacionId}-${modalidadId}`
  // para el resto (ej. 'rumba-pareja') — ver claveTarifaPersonal() en lib/planes.ts.
  personales: Record<string, TarifaPersonal>
  vacacionesPorNino: number
  virtualPorMes: number
}

// ── rutinas_virtuales/{rutinaId} ──────────────────────────────
// Plan Virtual: rutina remota armada por un profesor/admin para UN
// alumno específico. No hay clases/sede/horario — solo contenido y
// progreso. Ver rutinas_virtuales/{id}/sesiones/{id} para el contenido.

export interface RutinaVirtual {
  id: string
  rutinaId: string
  alumnoId: string
  profesorId: string
  nombre: string
  estado: 'activa' | 'archivada'
  creadoEn: number
  actualizadoEn: number
  // Desnormalizado para mostrar sin join
  nombre_alumno?: string
  nombre_profesor?: string
}

// ── rutinas_virtuales/{rutinaId}/sesiones/{sesionId} ──────────
// completada/completadaEn son los ÚNICOS campos que el alumno dueño
// puede escribir (ver firestore.rules) — todo lo demás lo controla
// el profesor/admin de la rutina.

export interface SesionVirtual {
  id: string
  sesionId: string
  titulo: string
  descripcion: string
  videoUrl: string
  orden: number
  completada: boolean
  completadaEn: number | null
  creadoEn: number
  actualizadoEn: number
}

// ── sugerencias/{sugerenciaId} ──────────
// Feedback enviado por los usuarios desde su perfil.
// Los administradores pueden leer y responder.

export interface Sugerencia {
  id?: string
  uid: string
  displayName: string
  mensaje: string
  createdAt: number
  leida: boolean
  respuesta?: string
  respondidaAt?: number
}

// ── notificaciones/{notificacionId} ─────
// Avisos por acciones que afectan a otro usuario (no solo mensajes de
// chat): plan aprobado/rechazado, comprobante subido, clase personalizada
// solicitada/aceptada/rechazada/cancelada. `destinatarioId` apunta a un
// usuario puntual; `paraRol` (solo 'admin' por ahora) es un aviso para
// cualquier admin, ya que el estudiante que sube un comprobante no puede
// saber los uid de los admins. Exactamente uno de los dos está presente.

export type TipoNotificacion =
  | 'plan_aprobado'
  | 'plan_rechazado'
  | 'comprobante_subido'
  | 'clase_solicitada'
  | 'clase_aceptada'
  | 'clase_rechazada'
  | 'clase_cancelada'

export interface Notificacion {
  id?: string
  destinatarioId?: string | null
  paraRol?: 'admin' | null
  tipo: TipoNotificacion
  titulo: string
  mensaje: string
  enlace?: string | null
  actorId: string
  leida: boolean
  creadoEn: number
}
