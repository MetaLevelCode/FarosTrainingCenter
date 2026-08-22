// ============================================================
// FAROS — Semanario y ciclo de matrícula
// El alumno no reserva hora por hora: arma su SEMANA eligiendo los
// días en que quiere entrenar (según los cupos de su plan). En planes
// como el individual, el día/hora elegido queda RESERVADO de forma
// recurrente con su profesor una vez el plan está activo.
//
// La matrícula sigue el flujo real (comprobante → aprobar):
//   pendiente  → el alumno envió su solicitud y su comprobante de pago;
//                el admin lo está revisando
//   activo     → el admin aprobó: la suscripción queda activa de inmediato
//   vencido    → expiró (o nunca hubo plan); debe renovar
//
// Lógica pura, lista para conectarse a Firestore (mismo patrón que
// lib/planes.ts).
// ============================================================

import type { PlanAsignado } from './planes'
import type { SuscripcionActiva, Transaccion } from './types'

/**
 * Fase del estudiante en el ciclo de matrícula. Se define aquí y no se
 * hereda de planes.ts para que el semanario no dependa del catálogo
 * local: el estado real sale de Firestore (suscripción + transacción).
 */
export type Fase = 'pendiente' | 'activo' | 'vencido'

export const FASE_LABEL: Record<Fase, string> = {
  pendiente: 'En revisión',
  activo: 'Activo',
  vencido: 'Vencido',
}

/**
 * Traduce el estado guardado en Firestore a la fase que ve el alumno.
 *
 * La suscripción solo existe una vez el admin aprueba (aprobar y activar
 * son un solo paso atómico — ver aprobarTransaccion), así que mientras
 * haya una transacción sin resolver el alumno está pendiente de revisión.
 */
export function faseDeSuscripcion(
  susc: SuscripcionActiva | null | undefined,
  transaccion?: Pick<Transaccion, 'estado'> | null,
): Fase {
  if (susc && susc.estado === 'activa') return 'activo'
  if (susc && susc.estado === 'vencida') return 'vencido'
  if (transaccion?.estado === 'pendiente') return 'pendiente'
  return 'vencido'
}

/** Sesiones que le quedan al estudiante para reservar. */
export function cuposDisponibles(susc: SuscripcionActiva | null | undefined): number {
  return Math.max(0, susc?.sesionesRestantes ?? 0)
}

/**
 * Normaliza fechaVencimiento a un `Date` o null. Acepta number (ms), string ISO
 * y Firestore Timestamp — devuelve null si el valor no es una fecha válida.
 */
export function parseVencimiento(raw: unknown): Date | null {
  if (raw == null) return null
  let ms: number
  if (typeof raw === 'number') ms = raw
  else if (typeof raw === 'string') ms = Date.parse(raw)
  else if (typeof raw === 'object') {
    const r = raw as { seconds?: number; toMillis?: () => number }
    if (typeof r.toMillis === 'function') ms = r.toMillis()
    else if (typeof r.seconds === 'number') ms = r.seconds * 1000
    else return null
  } else return null
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Solo el alumno con plan activo tiene acceso total. */
export function esAlumnoCompleto(fase: Fase): boolean {
  return fase === 'activo'
}

// ── Pasos del flujo, para el indicador de progreso ──
export interface Paso { key: string; label: string; icon: string }

export const PASOS: Paso[] = [
  { key: 'solicitud', label: 'Solicitud', icon: 'send' },
  { key: 'aprobacion', label: 'Aprobación', icon: 'verified' },
]

/** Nº de pasos completados según la fase (para pintar el tracker). */
export function pasosCompletados(fase: Fase): number {
  switch (fase) {
    case 'pendiente': return 1   // solicitud + comprobante enviados, esperando revisión
    case 'activo': return 2      // aprobado → completo
    default: return 0            // vencido
  }
}

// ── Días de la semana (semanario) ──
export interface Dia { dow: number; nombre: string; corto: string }

export const SEMANA: Dia[] = [
  { dow: 1, nombre: 'Lunes', corto: 'Lun' },
  { dow: 2, nombre: 'Martes', corto: 'Mar' },
  { dow: 3, nombre: 'Miércoles', corto: 'Mié' },
  { dow: 4, nombre: 'Jueves', corto: 'Jue' },
  { dow: 5, nombre: 'Viernes', corto: 'Vie' },
  { dow: 6, nombre: 'Sábado', corto: 'Sáb' },
]

// Horas que ofrece la sede (se reemplaza por la agenda real en Firestore).
export const HORAS = ['6:00 AM', '8:00 AM', '10:00 AM', '2:00 PM', '4:00 PM', '6:00 PM', '8:00 PM']

/** Cupos = días por semana que otorga el plan (1×, 2× o 3×). */
export function cuposDelPlan(plan: PlanAsignado): number {
  return Math.max(1, plan.week)
}

/** Los días que el alumno ya tiene elegidos/reservados en su plan. */
export function diasDelPlan(plan: PlanAsignado): number[] {
  return (plan.dias ?? []).map((d) => d.dow)
}

/** La hora preferida del plan (el semanario prioriza el día sobre la hora). */
export function horaDelPlan(plan: PlanAsignado): string {
  return plan.dias?.[0]?.hora ?? '6:00 PM'
}

// ¿Este tipo de plan reserva al profesor de forma recurrente?
// (individual, pareja, familia, reducido, funcional → sí; grupal → horario fijo del grupo)
export function reservaProfesor(plan: PlanAsignado): boolean {
  return plan.tipo === 'personal'
}
