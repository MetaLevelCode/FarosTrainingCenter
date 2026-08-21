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
  fechaVencimiento: number
  estado: 'activa' | 'vencida'
}

export interface Estadisticas {
  clasesReservadas: number
  clasesAsistidas: number
  tasaAsistencia: number
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
  // Estudiantes
  nivel?: string
  dificultades?: string[]
  fecha_registro?: number
  estadisticas?: Estadisticas
  suscripcionActiva?: SuscripcionActiva | null
}

// Helper computado (no se guarda en Firestore)
export function displayName(u: Pick<Usuario, 'nombres' | 'apellidos'>): string {
  return `${u.nombres} ${u.apellidos}`.trim()
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

export interface Plan {
  id: string
  planId: string
  nombre: string
  descripcion: string
  catalogo_codigo: string
  sesiones_incluidas: number
  duracion_dias: number
  precio_total: number
  sede: string
  estado: boolean
  creadoEn: number
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

// ── codigos_invitacion/{codigo} ──────────────────────────────

export interface CodigoInvitacion {
  codigo: string
  creadoPor: string
  creadoEn: number
  rol: 'profesor'
  activo: boolean
  usadoPor?: string | null
  usadoEn?: number | null
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
  estado: 'programada' | 'en_curso' | 'finalizada' | 'cancelada'
  plan?: string[]
  observaciones_profesor?: string | null
  creadoEn: number
  actualizadoEn: number
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
// Grupo grupal con horario fijo. Vive en una sede. El wizard "grupal"
// carga los grupos disponibles según la sede que elija el alumno.

export interface Grupo {
  id: string
  nombre: string
  sedeCodigo: string
  horarios: string[]     // ["Lun · 6:00 PM", "Mié · 6:00 PM"]
  nivel: string
  coach?: string
  cupoMaximo: number
  disponible: boolean
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

export interface TarifaConjunto {
  precios: Record<number, number | null>  // por frecuencia semanal (1 o 2)
}

export interface Tarifas {
  version: number
  actualizadoEn: number
  actualizadoPor?: string
  // Grupal: precio POR SESIÓN según frecuencia semanal
  grupoPorSesion: Record<number, number>  // { 1: 15000, 2: 12000, 3: 10000 }
  // Personales: precio mensual según sesionesPorMes
  personales: Record<string, TarifaPersonal>
  // Conjuntos: precio mensual según frecuencia semanal (1 o 2)
  conjuntos: Record<string, TarifaConjunto>
  vacacionesPorNino: number
}
