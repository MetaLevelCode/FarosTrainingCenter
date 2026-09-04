// ============================================================
// FAROS — Mensajería alumno ↔ profesor (estilo Classroom)
// Dos canales, sobre Firestore real:
//   · grupo   → el muro del grupo (todos los alumnos inscritos + el
//               coach). Persistente semana a semana: se identifica por
//               un slug de `nombre_clase`, NO por el id de una sesión
//               puntual (`clases/{id}` es una fecha/hora concreta).
//   · privado → conversación 1 a 1 entre un alumno y un profesor.
//
// Colecciones:
//   mensajes/{canalId}            — doc de control (solo Admin SDK +
//                                    reglas; el cliente nunca lo lee).
//   mensajes/{canalId}/items/{id} — los mensajes reales.
//
// La membresía del canal grupal (`participantes`) la mantiene cada ruta
// que toca `estudiantes_inscritos` de una clase: /api/clases/[id]/inscribir
// y /cancelar, /api/personalizadas/[id]/aceptar (genera las clases del
// grupo) y /api/grupos-personalizados/unirse (suma miembros después).
// Toda ruta nueva que agregue alumnos a una clase debe hacer lo mismo o
// quedan sin permiso para leer/escribir su canal (firestore.rules exige
// estar en `participantes`). Este módulo NO escribe `participantes`.
// ============================================================

import { getFirebase } from './firebase'

export type Autor = 'alumno' | 'entrenador'

export interface Mensaje {
  id: string
  autorId: string
  autorNombre: string
  autorRol: Autor
  autorFoto?: string | null
  texto: string
  ts: number        // epoch ms
}

/** Slug estable a partir del nombre de la clase — identidad del muro grupal. */
export const canalGrupo = (nombreClase: string) =>
  `grupo:${nombreClase.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'general'}`

/** Canal privado alumno ↔ profesor. Orden fijo → id estable y parseable en reglas. */
export const canalPrivado = (coachId: string, alumnoId: string) => `dm:${coachId}:${alumnoId}`

/** Envía un mensaje real a Firestore (client SDK, gobernado por firestore.rules). */
export async function enviarMensaje(
  canalId: string, autorId: string, autorNombre: string, autorRol: Autor, texto: string,
  autorFoto?: string | null,
): Promise<void> {
  const limpio = texto.trim()
  if (!limpio) return
  const [{ db }, { collection, addDoc }] = await Promise.all([
    getFirebase(), import('firebase/firestore'),
  ])
  await addDoc(collection(db, 'mensajes', canalId, 'items'), {
    autorId, autorNombre, autorRol, texto: limpio, ts: Date.now(),
    ...(autorFoto ? { autorFoto } : {}),
  })
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
