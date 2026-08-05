// ============================================================
// FAROS — Domain Types (Firestore schema)
// ============================================================

export type UserRole = 'admin' | 'profesor' | 'estudiante'

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
  comprobante_url?: string
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
