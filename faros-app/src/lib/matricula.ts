// ============================================================
// FAROS — Semanario y ciclo de matrícula
// El alumno no reserva hora por hora: arma su SEMANA eligiendo los
// días en que quiere entrenar (según los cupos de su plan). En planes
// como el individual, el día/hora elegido queda RESERVADO de forma
// recurrente con su profesor una vez el plan está activo.
//
// La matrícula pasa por un flujo real:
//   pendiente  → el alumno envió su solicitud; el admin coordina con
//                el profesor si ese día/hora/sede es posible
//   por_pagar  → confirmado; el alumno ya puede pagar
//   activo     → pagó; es "alumno completo" (acceso total)
//   vencido    → expiró; debe renovar
//
// Lógica pura, lista para conectarse a Firestore (mismo patrón que
// lib/registro.ts y lib/planes.ts).
// ============================================================

import type { PlanAsignado } from './planes'
import type { SuscripcionActiva, Transaccion } from './types'

/**
 * Fase del estudiante en el ciclo de matrícula. Se define aquí y no se
 * hereda de planes.ts para que el semanario no dependa del catálogo
 * local: el estado real sale de Firestore (suscripción + transacción).
 */
export type Fase = 'pendiente' | 'por_pagar' | 'activo' | 'vencido'

export const FASE_LABEL: Record<Fase, string> = {
  pendiente: 'En revisión',
  por_pagar: 'Por pagar',
  activo: 'Activo',
  vencido: 'Vencido',
}

/**
 * Traduce el estado guardado en Firestore a la fase que ve el alumno.
 *
 * La suscripción solo existe una vez aprobado el pago, así que mientras
 * haya una transacción sin resolver el alumno está esperando: pendiente
 * si el club aún revisa, por_pagar si ya le aprobaron y falta pagar.
 */
export function faseDeSuscripcion(
  susc: SuscripcionActiva | null | undefined,
  transaccion?: Pick<Transaccion, 'estado'> | null,
): Fase {
  if (susc && susc.estado === 'activa') return 'activo'
  if (susc && susc.estado === 'vencida') return 'vencido'
  if (transaccion?.estado === 'aprobada') return 'por_pagar'
  if (transaccion?.estado === 'pendiente') return 'pendiente'
  return 'vencido'
}

/** Sesiones que le quedan al estudiante para reservar. */
export function cuposDisponibles(susc: SuscripcionActiva | null | undefined): number {
  return Math.max(0, susc?.sesionesRestantes ?? 0)
}

/** Solo el alumno con plan activo (confirmado y pagado) tiene acceso total. */
export function esAlumnoCompleto(fase: Fase): boolean {
  return fase === 'activo'
}

/** El alumno solo puede pagar cuando el club ya confirmó su solicitud. */
export function puedePagar(fase: Fase): boolean {
  return fase === 'por_pagar'
}

// ── Pasos del flujo, para el indicador de progreso ──
export interface Paso { key: string; label: string; icon: string }

export const PASOS: Paso[] = [
  { key: 'solicitud', label: 'Solicitud', icon: 'send' },
  { key: 'confirmacion', label: 'Confirmación', icon: 'verified' },
  { key: 'pago', label: 'Pago', icon: 'payments' },
]

/** Nº de pasos completados según la fase (para pintar el tracker). */
export function pasosCompletados(fase: Fase): number {
  switch (fase) {
    case 'pendiente': return 1   // solicitud enviada, esperando confirmación
    case 'por_pagar': return 2   // confirmado, esperando pago
    case 'activo': return 3      // pagado → completo
    default: return 0            // vencido
  }
}

// ============================================================
// DOBLE VERIFICACIÓN (panel del admin)
// Una solicitud no se aprueba de un solo clic: el admin verifica
// dos cosas independientes y solo cuando AMBAS están listas el plan
// del alumno queda activo.
//   1. horario → coordinó con el profesor que ese día/hora es posible
//   2. pago    → el alumno ya pagó lo correspondiente
// ============================================================

export interface Verificaciones {
  horario: boolean
  pago: boolean
}

/** El plan solo se activa cuando ambas verificaciones están hechas. */
export function planActivable(v: Verificaciones): boolean {
  return v.horario && v.pago
}

/** Fase que le corresponde al alumno según lo verificado. */
export function faseSegunVerificacion(v: Verificaciones): Fase {
  if (v.horario && v.pago) return 'activo'
  if (v.horario) return 'por_pagar'   // confirmado, falta que pague
  return 'pendiente'                   // aún coordinando con el profesor
}

/** Qué le falta a una solicitud, en texto para el admin. */
export function faltantes(v: Verificaciones): string {
  if (v.horario && v.pago) return 'Lista para activar'
  if (!v.horario && !v.pago) return 'Falta horario y pago'
  return v.horario ? 'Falta el pago' : 'Falta confirmar horario'
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
