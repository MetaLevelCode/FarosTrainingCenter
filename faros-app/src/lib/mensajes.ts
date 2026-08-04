// ============================================================
// FAROS — Mensajería alumno ↔ profesor (estilo Classroom)
// Dos canales:
//   · grupal  → el muro de la clase; todos los alumnos y el coach
//               comentan ahí ("qué buena clase", dudas del plan…)
//   · privado → conversación 1 a 1 entre un alumno y su profesor
//
// Lógica pura, lista para Firestore (mismo patrón que el resto de
// lib/). Los ids de canal son estables para poder mapearlos a
// colecciones: 'grupo:<claseId>' y 'dm:<alumnoId>:<coachId>'.
// ============================================================

export type Autor = 'alumno' | 'entrenador'

export interface Mensaje {
  id: string
  canalId: string
  autorId: string
  autorNombre: string
  autorRol: Autor
  texto: string
  ts: number        // epoch ms
}

/** Canal del muro de una clase (todos los inscritos + el coach). */
export const canalGrupo = (claseId: string) => `grupo:${claseId}`

/** Canal privado alumno ↔ profesor. Orden fijo → id estable. */
export const canalPrivado = (alumnoId: string, coachId: string) => `dm:${alumnoId}:${coachId}`

export const COACH_ID = 'FR-C002'
export const COACH_NOMBRE = 'Ana Torres'

// ── Semilla de conversación (se reemplaza por Firestore) ──
const H = 3_600_000

export function mensajesSemilla(ahora = Date.now()): Mensaje[] {
  return [
    {
      id: 'm1', canalId: canalGrupo('knowill'), autorId: COACH_ID, autorNombre: COACH_NOMBRE,
      autorRol: 'entrenador', ts: ahora - 26 * H,
      texto: 'Subí el plan de la sesión de mañana. Revisen el bloque de técnica antes de llegar.',
    },
    {
      id: 'm2', canalId: canalGrupo('knowill'), autorId: 'FR-1045', autorNombre: 'Sofía Ruiz',
      autorRol: 'alumno', ts: ahora - 24 * H,
      texto: '¡Listo, coach! ¿Los 8 × 100 son con aletas?',
    },
    {
      id: 'm3', canalId: canalGrupo('knowill'), autorId: COACH_ID, autorNombre: COACH_NOMBRE,
      autorRol: 'entrenador', ts: ahora - 23 * H,
      texto: 'Sin aletas. La idea es sostener el ritmo con técnica limpia.',
    },
    {
      id: 'm4', canalId: canalGrupo('knowill'), autorId: 'FR-0922', autorNombre: 'Carlos Méndez',
      autorRol: 'alumno', ts: ahora - 2 * H,
      texto: '¡Qué buena clase la de hoy! Sentí mucho mejor el codo alto 💪',
    },
    {
      id: 'p1', canalId: canalPrivado('FR-0922', COACH_ID), autorId: COACH_ID, autorNombre: COACH_NOMBRE,
      autorRol: 'entrenador', ts: ahora - 20 * H,
      texto: 'Carlos, te vi mejor en los virajes. Sigue trabajando el impulso de pared.',
    },
    {
      id: 'p2', canalId: canalPrivado('FR-0922', COACH_ID), autorId: 'FR-0922', autorNombre: 'Carlos Méndez',
      autorRol: 'alumno', ts: ahora - 19 * H,
      texto: 'Gracias coach. ¿Puedo llegar 15 min antes el jueves para practicarlos?',
    },
    {
      id: 'p3', canalId: canalPrivado('FR-0922', COACH_ID), autorId: COACH_ID, autorNombre: COACH_NOMBRE,
      autorRol: 'entrenador', ts: ahora - 18 * H,
      texto: 'Claro, nos vemos a las 5:45 en la Piscina A.',
    },
  ]
}

/** Mensajes de un canal, del más antiguo al más reciente. */
export function delCanal(todos: Mensaje[], canalId: string): Mensaje[] {
  return todos.filter((m) => m.canalId === canalId).sort((a, b) => a.ts - b.ts)
}

/** Crea un mensaje nuevo listo para agregarse al hilo. */
export function nuevoMensaje(
  canalId: string, autorId: string, autorNombre: string, autorRol: Autor, texto: string,
): Mensaje {
  return {
    id: `${canalId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    canalId, autorId, autorNombre, autorRol, texto: texto.trim(), ts: Date.now(),
  }
}

/** Hora relativa corta: "ahora", "hace 3 h", "ayer", "12 Ago". */
export function cuando(ts: number, ahora = Date.now()): string {
  const min = Math.floor((ahora - ts) / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  if (h < 48) return 'ayer'
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(ts))
}
