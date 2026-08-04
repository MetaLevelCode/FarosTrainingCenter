// ============================================================
// FAROS — Agenda del entrenador (calendario)
// El portal del coach gira alrededor de un calendario: cada día
// muestra las clases asignadas; al abrir una clase, el coach ve o
// sube su PLAN DE CLASE (que luego ve el alumno) y registra la
// ASISTENCIA de ese día.
//
// El horario del coach es recurrente (día de la semana + hora); de
// ahí se generan las clases de cada mes. Lógica pura, lista para
// Firestore (mismo patrón que lib/planes.ts y lib/matricula.ts).
// ============================================================

export interface Alumno { id: string; nombre: string }

// Alumnos que entrena este coach (se reemplaza por Firestore).
export const COACH_ALUMNOS: Alumno[] = [
  { id: 'FR-0922', nombre: 'Carlos Méndez' },
  { id: 'FR-1045', nombre: 'Sofía Ruiz' },
  { id: 'FR-0871', nombre: 'Diego Morales' },
  { id: 'FR-1198', nombre: 'Valentina Castro' },
  { id: 'FR-0634', nombre: 'Andrés Rojas' },
  { id: 'FR-1302', nombre: 'Mariana Duque' },
]

export type TipoClase = 'Grupal' | 'Personal'

// Plantilla del horario recurrente. dow: 1 = lunes … 6 = sábado.
export interface PlantillaClase {
  dow: number
  hora: string
  hora24: number
  tipo: TipoClase
  titulo: string
  sede: string
  alumnoId?: string   // para clases personales (1 alumno)
}

export const AGENDA_COACH: PlantillaClase[] = [
  { dow: 1, hora: '5:30 PM', hora24: 17, tipo: 'Personal', titulo: 'Diego Morales', sede: 'Piscina B', alumnoId: 'FR-0871' },
  { dow: 2, hora: '6:00 PM', hora24: 18, tipo: 'Grupal', titulo: 'Knowill UTP', sede: 'Piscina A' },
  { dow: 3, hora: '6:00 AM', hora24: 6, tipo: 'Grupal', titulo: 'Resistencia AM', sede: 'Piscina A' },
  { dow: 4, hora: '6:00 PM', hora24: 18, tipo: 'Grupal', titulo: 'Knowill UTP', sede: 'Piscina A' },
  { dow: 6, hora: '2:00 PM', hora24: 14, tipo: 'Grupal', titulo: 'Knowill UTP', sede: 'Piscina A' },
]

// ── Plan de clase (lo sube el coach; lo ve el alumno) ──
export interface PlanClase {
  titulo: string
  bloques: string[]   // pasos de la sesión
}

// ── Una clase concreta en el calendario ──
export interface Clase {
  id: string          // 'YYYY-MM-DD_hora24'
  iso: string         // día (YYYY-MM-DD)
  dow: number
  hora: string
  hora24: number
  tipo: TipoClase
  titulo: string
  sede: string
  alumnos: Alumno[]
}

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// getDay() → nuestro dow (0=Dom → 7, 1=Lun → 1 …)
const aDow = (jsDay: number) => (jsDay === 0 ? 7 : jsDay)

function alumnosDe(p: PlantillaClase): Alumno[] {
  if (p.tipo === 'Personal' && p.alumnoId) {
    const a = COACH_ALUMNOS.find((x) => x.id === p.alumnoId)
    return a ? [a] : []
  }
  // Grupal: todos los alumnos del coach (se filtrará por grupo en Firestore).
  return COACH_ALUMNOS
}

/** Clases de un día concreto, ordenadas por hora. */
export function clasesDelDia(fecha: Date): Clase[] {
  const dow = aDow(fecha.getDay())
  const iso = isoDe(fecha)
  return AGENDA_COACH
    .filter((p) => p.dow === dow)
    .sort((a, b) => a.hora24 - b.hora24)
    .map((p) => ({
      id: `${iso}_${p.hora24}`,
      iso,
      dow,
      hora: p.hora,
      hora24: p.hora24,
      tipo: p.tipo,
      titulo: p.titulo,
      sede: p.sede,
      alumnos: alumnosDe(p),
    }))
}

// ── Celda del calendario ──
export interface Celda {
  fecha: Date | null   // null = relleno fuera del mes
  iso: string
  clases: Clase[]
}

/**
 * Rejilla del mes (semanas de lunes a domingo). Incluye celdas de
 * relleno al inicio para alinear el primer día con su columna.
 */
export function mallaDelMes(anio: number, mes: number): Celda[][] {
  const primero = new Date(anio, mes, 1)
  const offset = aDow(primero.getDay()) - 1 // columnas vacías antes del día 1
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()

  const celdas: Celda[] = []
  for (let i = 0; i < offset; i++) celdas.push({ fecha: null, iso: `pad-${i}`, clases: [] })
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = new Date(anio, mes, d)
    celdas.push({ fecha, iso: isoDe(fecha), clases: clasesDelDia(fecha) })
  }
  while (celdas.length % 7 !== 0) celdas.push({ fecha: null, iso: `pad-fin-${celdas.length}`, clases: [] })

  const semanas: Celda[][] = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))
  return semanas
}

// ── Plan de clase de ejemplo (algunas clases ya vienen con plan
//    "subido"; otras no, para que el coach lo suba). Se reemplaza por
//    los planes reales del coach en Firestore. ──
const PLAN_KNOWILL: PlanClase = {
  titulo: 'Técnica y resistencia',
  bloques: [
    'Calentamiento: 400 m libre ritmo suave',
    'Técnica: 6 × 50 m brazada con enfoque en codo alto',
    'Serie principal: 8 × 100 m al 80 % con 20 s de descanso',
    'Vuelta a la calma: 200 m suave',
  ],
}

/**
 * Id del grupo al que pertenece el muro de una clase. Es lo que hace
 * que el coach y sus alumnos vean EL MISMO hilo: las clases grupales
 * comparten muro por grupo (todas las sesiones de "Knowill UTP" son un
 * solo muro), y las personales tienen el suyo propio.
 */
export function grupoDeClase(clase: Clase): string {
  if (clase.tipo === 'Personal') return `personal-${clase.alumnos[0]?.id ?? clase.id}`
  return clase.titulo.toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '')
}

/** Plan "pre-cargado" de una clase (o null si el coach aún no lo sube). */
export function planSemilla(clase: Clase): PlanClase | null {
  // Demo: las clases grupales de Knowill ya traen plan; el resto no.
  return clase.tipo === 'Grupal' && clase.titulo === 'Knowill UTP' ? PLAN_KNOWILL : null
}
