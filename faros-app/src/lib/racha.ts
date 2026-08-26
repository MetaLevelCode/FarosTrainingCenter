// ============================================================
// FAROS — Racha semanal de asistencia
//
// Sube +1 por cada semana calendario (lunes–domingo) con al menos una
// asistencia real. No se rompe por una semana "en blanco" si esa semana
// tenía un comodín válido: el alumno no tenía ninguna clase programada
// (ej. entre ciclos de matrícula), o canceló su clase con anticipación
// (dentro de la ventana de /api/clases/[id]/cancelar — llegar a escribir
// en `cancelaciones` ya implica que fue a tiempo). Se rompe a 0 solo
// cuando SÍ tenía clase esa semana, no la canceló, y no hay asistencia.
//
// La semana en curso nunca cuenta en contra — todavía no terminó.
// ============================================================

const MS_SEMANA = 7 * 24 * 60 * 60 * 1000
const MAX_SEMANAS = 52 // salvaguarda — evita loops largos por falta de datos

/** Inicio (lunes 00:00 local) de la semana calendario que contiene `ts`. */
export function inicioSemana(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // retrocede a lunes
  return d.getTime()
}

export interface RachaInput {
  asistencias: { fecha_registro: number; asistio: boolean }[]
  /** Clases (pasadas o programadas) en las que el alumno estuvo/está inscrito. */
  clasesHistoricas: { fecha_hora_inicio: number }[]
  /** Cancelaciones a tiempo (ver colección `cancelaciones`). */
  cancelaciones: { fecha_hora_clase: number }[]
}

export function calcularRacha(input: RachaInput, ahora = Date.now()): number {
  const semanaActual = inicioSemana(ahora)
  let racha = 0
  let semana = semanaActual

  for (let i = 0; i < MAX_SEMANAS; i++) {
    const fin = semana + MS_SEMANA
    const enRango = (ts: number) => ts >= semana && ts < fin

    const asistio = input.asistencias.some((a) => a.asistio && enRango(a.fecha_registro))
    if (asistio) {
      racha++
      semana -= MS_SEMANA
      continue
    }

    // La semana en curso todavía no terminó — no puede romper la racha.
    if (semana === semanaActual) {
      semana -= MS_SEMANA
      continue
    }

    const canceloATiempo = input.cancelaciones.some((c) => enRango(c.fecha_hora_clase))
    const tuvoClase = input.clasesHistoricas.some((c) => enRango(c.fecha_hora_inicio))

    if (canceloATiempo || !tuvoClase) {
      // Comodín: la semana se pausa, no suma ni rompe.
      semana -= MS_SEMANA
      continue
    }

    break // tenía clase, no fue, no canceló a tiempo → racha rota aquí
  }

  return racha
}
