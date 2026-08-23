// ============================================================
// FAROS — Recurrencia semanal (clases personalizadas)
// Generaliza la lógica de "próxima ocurrencia" que ya usa
// scripts/api/seed-clases/route.ts para las clases personalizadas:
// dado un día de la semana + franja horaria fijos, genera TODAS las
// ocurrencias semanales entre `desde` y `hastaTs` (exclusivo).
// ============================================================

function parseHora(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number)
  return { h, m }
}

// Duración fija de una clase personalizada — el profesor declara una
// franja de disponibilidad (puede ser de varias horas), pero cada clase
// dura esto. El alumno elige un horario de inicio dentro de la franja,
// no la franja completa (ver slotsDisponibles).
export const DURACION_PERSONALIZADA_MIN = 60

export function sumarMinutos(hhmm: string, minutos: number): string {
  const { h, m } = parseHora(hhmm)
  const total = h * 60 + m + minutos
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Horarios de inicio posibles (cada uno de `duracionMin`) dentro de una franja. */
export function slotsDisponibles(
  horaInicio: string, horaFin: string, duracionMin: number = DURACION_PERSONALIZADA_MIN,
): string[] {
  const slots: string[] = []
  let cursor = horaInicio
  while (sumarMinutos(cursor, duracionMin) <= horaFin) {
    slots.push(cursor)
    cursor = sumarMinutos(cursor, duracionMin)
  }
  return slots
}

/** Próxima fecha (Date) para un dow+hora, N semanas adelante de `desde`. */
function proximaFecha(dow: number, horaStr: string, semanaOffset: number, desde: Date): Date {
  const { h, m } = parseHora(horaStr)
  const d = new Date(desde)
  d.setHours(0, 0, 0, 0)
  let diff = (dow - d.getDay() + 7) % 7
  const yaPaso = desde.getHours() > h || (desde.getHours() === h && desde.getMinutes() >= m)
  if (diff === 0 && yaPaso) diff = 7
  d.setDate(d.getDate() + diff + semanaOffset * 7)
  d.setHours(h, m, 0, 0)
  return d
}

export interface Ocurrencia {
  inicio: number
  fin: number
}

// Tope duro (~1 año a 1x/semana) — guarda barata contra datos corruptos
// (ej. una fechaVencimiento mal seteada generando cientos de clases).
const MAX_OCURRENCIAS = 60

/**
 * Todas las ocurrencias semanales de un dow+franja horaria entre `desde`
 * (inclusive) y `hastaTs` (exclusivo).
 */
export function ocurrenciasSemanales(
  dow: number,
  horaInicioStr: string,
  horaFinStr: string,
  desde: Date,
  hastaTs: number,
): Ocurrencia[] {
  const { h: hFin, m: mFin } = parseHora(horaFinStr)
  const ocurrencias: Ocurrencia[] = []
  for (let semana = 0; ocurrencias.length < MAX_OCURRENCIAS; semana++) {
    const inicio = proximaFecha(dow, horaInicioStr, semana, desde)
    if (inicio.getTime() >= hastaTs) break
    const fin = new Date(inicio)
    fin.setHours(hFin, mFin, 0, 0)
    ocurrencias.push({ inicio: inicio.getTime(), fin: fin.getTime() })
  }
  return ocurrencias
}
