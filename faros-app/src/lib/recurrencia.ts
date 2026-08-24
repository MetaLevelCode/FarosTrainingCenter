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

// Colombia opera con zona horaria UTC-5 fija (sin horario de verano).
export const COLOMBIA_OFFSET_HOURS = -5
export const COLOMBIA_OFFSET_MS = COLOMBIA_OFFSET_HOURS * 60 * 60 * 1000

/** Convierte una fecha o timestamp a componentes locales de Colombia. */
export function toColombiaDate(dateOrTs: Date | number): Date {
  const utc = typeof dateOrTs === 'number' ? dateOrTs : dateOrTs.getTime()
  return new Date(utc + COLOMBIA_OFFSET_MS)
}

/** Construye un timestamp UTC a partir de componentes de fecha/hora en Colombia. */
export function fromColombiaComponents(
  year: number, month: number, day: number, hours: number, minutes: number = 0,
): number {
  return Date.UTC(year, month, day, hours - COLOMBIA_OFFSET_HOURS, minutes, 0, 0)
}

/** Extrae la hora local de Colombia en formato HH:mm a partir de un timestamp. */
export function horaColombia(ts: number): string {
  const d = toColombiaDate(ts)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Extrae el día de la semana (0=Dom...6=Sáb) en Colombia a partir de un timestamp. */
export function dowColombia(ts: number): number {
  return toColombiaDate(ts).getUTCDay()
}

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

/** Próxima fecha (Date) para un dow+hora en Colombia, N semanas adelante de `desde`. */
function proximaFecha(dow: number, horaStr: string, semanaOffset: number, desde: Date): Date {
  const { h, m } = parseHora(horaStr)
  const colDesde = toColombiaDate(desde)
  const colYear = colDesde.getUTCFullYear()
  const colMonth = colDesde.getUTCMonth()
  const colDay = colDesde.getUTCDate()
  const colDow = colDesde.getUTCDay()
  const colHours = colDesde.getUTCHours()
  const colMinutes = colDesde.getUTCMinutes()

  let diff = (dow - colDow + 7) % 7
  const yaPaso = colHours > h || (colHours === h && colMinutes >= m)
  if (diff === 0 && yaPaso) diff = 7

  const targetDay = colDay + diff + semanaOffset * 7
  const targetTs = fromColombiaComponents(colYear, colMonth, targetDay, h, m)
  return new Date(targetTs)
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
 * (inclusive) y `hastaTs` (exclusivo) calculadas en hora local de Colombia.
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
    const inicioDate = proximaFecha(dow, horaInicioStr, semana, desde)
    const inicio = inicioDate.getTime()
    if (inicio >= hastaTs) break

    const colInicio = toColombiaDate(inicio)
    const fin = fromColombiaComponents(
      colInicio.getUTCFullYear(),
      colInicio.getUTCMonth(),
      colInicio.getUTCDate(),
      hFin,
      mFin,
    )
    ocurrencias.push({ inicio, fin })
  }
  return ocurrencias
}
