// ============================================================
// FAROS — Catálogo y motor de precios de planes
// El precio de un plan de natación no es una tarifa plana: depende
// de la modalidad, la frecuencia, el número de personas y la sede.
// Este módulo modela esas variables (tomadas de las tarifas reales
// del club) y calcula el precio final del plan que el usuario arma.
// Montos en COP. Se reemplazará por Firestore cuando el admin
// gestione planes desde su panel.
// ============================================================

export type TipoPlan = 'grupal' | 'personal' | 'conjunto' | 'vacaciones'

export interface OpcionTipo {
  id: TipoPlan
  nombre: string
  desc: string
  icon: string
  detalle: string[]  // se revela al seleccionar
}

export const TIPOS: OpcionTipo[] = [
  {
    id: 'grupal', nombre: 'Grupal UTP', desc: 'Entrena en grupo con horarios fijos en las sedes UTP.', icon: 'groups',
    detalle: ['Entrenador certificado por grupo', 'Ambiente motivador y constante', 'La opción más económica por sesión'],
  },
  {
    id: 'personal', nombre: 'Personalizado', desc: 'Individual, en pareja, en familia o en grupo reducido.', icon: 'person',
    detalle: ['Atención uno a uno o en grupo cerrado', 'Plan ajustado a tu nivel y meta', 'Máxima flexibilidad de horario'],
  },
  {
    id: 'conjunto', nombre: 'Conjuntos', desc: 'Combina natación con acuagym, funcional o rumbaterapia.', icon: 'pool',
    detalle: ['Combina disciplinas en un solo plan', 'Trabajo dentro y fuera del agua', 'Progreso más integral'],
  },
  {
    id: 'vacaciones', nombre: 'Vacaciones deportivas', desc: 'Programa intensivo de 2 semanas para niños.', icon: 'child_care',
    detalle: ['Programa intensivo de 2 semanas', 'Pensado para niños y jóvenes', 'Técnica y diversión en el receso'],
  },
]

// ── Grupos con horario fijo (sedes UTP) ──
export interface Grupo {
  id: string
  nombre: string
  horarios: string[]
  disponible: boolean
  // se revela al seleccionar
  nivel: string
  cupos: string
  coach: string
}

export const GRUPOS: Grupo[] = [
  { id: 'knowill', nombre: 'Knowill UTP', horarios: ['Mar · 6:00 PM', 'Jue · 6:00 PM', 'Sáb · 2:00 PM'], disponible: true, nivel: 'Intermedio – avanzado', cupos: '4 cupos disponibles', coach: 'Coach Ana Torres' },
  { id: 'estrellas', nombre: 'Estrellas UTP', horarios: ['Lun · 6:00 PM', 'Mié · 6:00 PM', 'Sáb · 10:00 AM'], disponible: true, nivel: 'Todos los niveles', cupos: '6 cupos disponibles', coach: 'Coach Felipe Cárdenas' },
  { id: 'tulcan', nombre: 'Tulcán II', horarios: ['Mié · 6:00 PM', 'Vie · 6:00 PM'], disponible: true, nivel: 'Iniciación', cupos: '8 cupos disponibles', coach: 'Coach Marcos Ruiz' },
  { id: 'bambu', nombre: 'Grupo Bambú', horarios: ['Horario por confirmar'], disponible: false, nivel: 'Por definir', cupos: 'Apertura próxima', coach: 'Por asignar' },
]

// Precio POR SESIÓN según la frecuencia semanal (a mayor compromiso, menor tarifa)
export const GRUPO_POR_SESION: Record<number, number> = { 1: 15_000, 2: 12_000, 3: 10_000 }

// ── Modalidades personales (precio mensual por nº de sesiones) ──
export interface SubPersonal {
  id: string
  nombre: string
  desc: string
  porPersona: boolean
  personasMin: number
  personasMax: number
  // precio mensual por sesiones/mes (4 = 1x/sem, 8 = 2x/sem, 12 = 3x/sem)
  precios: Record<number, number>
  incluye: string[]  // se revela al seleccionar
}

export const PERSONALES: SubPersonal[] = [
  {
    id: 'individual', nombre: 'Individual', desc: 'Uno a uno con tu entrenador.',
    porPersona: false, personasMin: 1, personasMax: 1,
    precios: { 4: 150_000, 8: 280_000, 12: 390_000 },
    incluye: ['Sesiones 100% para ti', 'Corrección técnica detallada', 'Horario a convenir'],
  },
  {
    id: 'pareja', nombre: 'Pareja', desc: 'Entrenen dos, precio por persona.',
    porPersona: true, personasMin: 2, personasMax: 2,
    precios: { 4: 115_000, 8: 200_000, 12: 250_000 },
    incluye: ['Entrenen dos a la vez', 'Tarifa por persona', 'Ideal para motivarse mutuamente'],
  },
  {
    id: 'familia', nombre: 'Familia', desc: 'Tarifa preferencial por integrante.',
    porPersona: true, personasMin: 3, personasMax: 5,
    precios: { 4: 110_000, 8: 190_000, 12: 240_000 },
    incluye: ['Tarifa preferencial por integrante', 'De 3 a 5 personas', 'Horarios compartidos en familia'],
  },
  {
    id: 'reducido', nombre: 'Grupo reducido', desc: 'De 3 a 5 personas, precio por persona.',
    porPersona: true, personasMin: 3, personasMax: 5,
    precios: { 4: 80_000, 8: 140_000, 12: 190_000 },
    incluye: ['Grupo cerrado de 3 a 5', 'Atención cercana del coach', 'Precio por persona'],
  },
  {
    id: 'funcional', nombre: 'Funcional adultos', desc: 'Acondicionamiento funcional para adultos.',
    porPersona: false, personasMin: 1, personasMax: 1,
    precios: { 4: 200_000, 8: 376_000, 12: 480_000 },
    incluye: ['Trabajo fuera del agua', 'Fuerza, movilidad y core', 'Complementa tu natación'],
  },
]

// ── Conjuntos (precio mensual por frecuencia semanal 1x/2x) ──
export interface Conjunto {
  id: string
  nombre: string
  desc: string
  precios: Record<number, number | null> // null = tarifa por confirmar
  incluye: string[]  // se revela al seleccionar
}

export const CONJUNTOS: Conjunto[] = [
  { id: 'nat-acuagym', nombre: 'Natación + Acuagym', desc: 'Técnica en el agua y bajo impacto articular.', precios: { 1: 240_000, 2: 480_000 }, incluye: ['Natación técnica', 'Acuagym de bajo impacto', 'Dos disciplinas en un plan'] },
  { id: 'funcional', nombre: 'Ejercicio funcional', desc: 'Fuerza y movilidad complementaria.', precios: { 1: 280_000, 2: 560_000 }, incluye: ['Trabajo funcional en seco', 'Fuerza y prevención de lesiones', 'Complementa tu natación'] },
  { id: 'rumba', nombre: 'Rumbaterapia', desc: 'Cardio rítmico en grupo.', precios: { 1: null, 2: null }, incluye: ['Cardio rítmico en grupo', 'Alta quema calórica', 'Tarifa por confirmar'] },
]

export const VACACIONES_POR_NINO = 150_000 // 2 semanas

// ── Frecuencias ──
export interface Frecuencia {
  week: number
  mes: number
  label: string
}

export const FRECUENCIAS: Frecuencia[] = [
  { week: 1, mes: 4, label: '1 vez / semana' },
  { week: 2, mes: 8, label: '2 veces / semana' },
  { week: 3, mes: 12, label: '3 veces / semana' },
]

// ── Estado del plan que arma el usuario ──
export interface SeleccionPlan {
  tipo: TipoPlan | null
  grupoId: string | null
  personalId: string | null
  conjuntoId: string | null
  week: number        // frecuencia semanal
  personas: number    // para modalidades por persona
  ninos: number       // para vacaciones
}

export const SELECCION_INICIAL: SeleccionPlan = {
  tipo: null, grupoId: null, personalId: null, conjuntoId: null,
  week: 2, personas: 2, ninos: 1,
}

export interface PrecioCalculado {
  disponible: boolean       // false → tarifa por confirmar
  total: number             // total mensual (o del programa) en COP
  porPersona: number | null // valor unitario cuando aplica
  personas: number
  detalleFrecuencia: string
}

export const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

// Motor de cálculo — la pieza central del flujo.
export function calcularPrecio(sel: SeleccionPlan): PrecioCalculado {
  const base: PrecioCalculado = { disponible: false, total: 0, porPersona: null, personas: 1, detalleFrecuencia: '' }

  if (sel.tipo === 'grupal') {
    const porSesion = GRUPO_POR_SESION[sel.week]
    const freq = FRECUENCIAS.find((f) => f.week === sel.week)!
    const grupo = GRUPOS.find((g) => g.id === sel.grupoId)
    if (!grupo || !grupo.disponible) return { ...base, detalleFrecuencia: freq.label }
    return {
      disponible: true,
      total: porSesion * freq.mes,
      porPersona: null,
      personas: 1,
      detalleFrecuencia: `${freq.label} · ${freq.mes} sesiones/mes`,
    }
  }

  if (sel.tipo === 'personal') {
    const sub = PERSONALES.find((p) => p.id === sel.personalId)
    const freq = FRECUENCIAS.find((f) => f.week === sel.week)!
    if (!sub) return { ...base, detalleFrecuencia: freq.label }
    const unit = sub.precios[freq.mes]
    const personas = sub.porPersona ? Math.min(Math.max(sel.personas, sub.personasMin), sub.personasMax) : 1
    return {
      disponible: true,
      total: sub.porPersona ? unit * personas : unit,
      porPersona: sub.porPersona ? unit : null,
      personas,
      detalleFrecuencia: `${freq.label} · ${freq.mes} sesiones/mes`,
    }
  }

  if (sel.tipo === 'conjunto') {
    const combo = CONJUNTOS.find((c) => c.id === sel.conjuntoId)
    const semanal = sel.week === 1 ? 1 : 2
    const freqLabel = semanal === 1 ? '1 vez / semana' : '2 veces / semana'
    if (!combo) return { ...base, detalleFrecuencia: freqLabel }
    const precio = combo.precios[semanal]
    if (precio == null) return { ...base, detalleFrecuencia: freqLabel }
    return { disponible: true, total: precio, porPersona: null, personas: 1, detalleFrecuencia: freqLabel }
  }

  if (sel.tipo === 'vacaciones') {
    const ninos = Math.max(1, sel.ninos)
    return {
      disponible: true,
      total: VACACIONES_POR_NINO * ninos,
      porPersona: ninos > 1 ? VACACIONES_POR_NINO : null,
      personas: ninos,
      detalleFrecuencia: 'Programa de 2 semanas',
    }
  }

  return base
}

// Resumen legible del plan seleccionado (para el paso final y la solicitud).
export function resumenPlan(sel: SeleccionPlan): { titulo: string; subtitulo: string; horarios: string[] } {
  if (sel.tipo === 'grupal') {
    const g = GRUPOS.find((x) => x.id === sel.grupoId)
    return { titulo: g?.nombre ?? 'Grupal UTP', subtitulo: 'Plan grupal · sede UTP', horarios: g?.horarios ?? [] }
  }
  if (sel.tipo === 'personal') {
    const p = PERSONALES.find((x) => x.id === sel.personalId)
    return { titulo: p?.nombre ?? 'Personalizado', subtitulo: 'Plan personalizado', horarios: [] }
  }
  if (sel.tipo === 'conjunto') {
    const c = CONJUNTOS.find((x) => x.id === sel.conjuntoId)
    return { titulo: c?.nombre ?? 'Conjunto', subtitulo: 'Plan conjunto', horarios: [] }
  }
  if (sel.tipo === 'vacaciones') {
    return { titulo: 'Vacaciones deportivas', subtitulo: 'Programa intensivo · 2 semanas', horarios: [] }
  }
  return { titulo: '', subtitulo: '', horarios: [] }
}

// ============================================================
// PLAN ASIGNADO — el plan que un usuario ya tiene contratado.
// Es la fuente de verdad compartida por el dashboard del alumno,
// el portal del entrenador y el panel admin: todos describen el
// mismo plan con las mismas cifras.
// ============================================================

// Ciclo de vida real del plan del alumno:
//  pendiente  → solicitud enviada, el admin coordina con el profesor
//  por_pagar  → confirmado que se puede; el alumno ya puede pagar
//  activo     → pagado; es "alumno completo" con acceso total
//  vencido    → expiró; debe renovar
export type EstadoPlan = 'pendiente' | 'por_pagar' | 'activo' | 'vencido'

export const ESTADO_LABEL: Record<EstadoPlan, string> = {
  pendiente: 'En revisión',
  por_pagar: 'Por pagar',
  activo: 'Activo',
  vencido: 'Vencido',
}

export interface DiaReservado {
  dow: number   // 1 = lunes … 6 = sábado
  hora: string  // '6:00 PM'
}

export interface PlanAsignado extends SeleccionPlan {
  estado: EstadoPlan
  desde: string             // fecha de inicio (texto legible)
  proximoPago: string       // próximo corte
  dias?: DiaReservado[]     // días de la semana reservados (semanario)
}

export interface PlanDescrito {
  titulo: string
  subtitulo: string
  horarios: string[]
  frecuenciaLabel: string
  sesionesMes: number
  precioMensual: number
  precioTexto: string
  etiqueta: string      // versión corta para tablas y chips
  tipoLabel: string
}

const TIPO_LABEL: Record<TipoPlan, string> = {
  grupal: 'Grupal',
  personal: 'Personalizado',
  conjunto: 'Conjunto',
  vacaciones: 'Vacaciones',
}

/** Describe un plan (asignado o en construcción) con cifras coherentes. */
export function describirPlan(sel: SeleccionPlan): PlanDescrito {
  const resumen = resumenPlan(sel)
  const precio = calcularPrecio(sel)
  const freq = FRECUENCIAS.find((f) => f.week === sel.week)

  const sesionesMes =
    sel.tipo === 'vacaciones' ? 10
    : sel.tipo === 'conjunto' ? (sel.week === 1 ? 4 : 8)
    : freq?.mes ?? 0

  const frecuenciaLabel =
    sel.tipo === 'vacaciones' ? 'Programa de 2 semanas' : freq?.label ?? ''

  const etiqueta =
    sel.tipo === 'vacaciones'
      ? `Vacaciones · ${sel.ninos} ${sel.ninos === 1 ? 'niño' : 'niños'}`
      : `${resumen.titulo} · ${sel.week}x`

  return {
    titulo: resumen.titulo,
    subtitulo: resumen.subtitulo,
    horarios: resumen.horarios,
    frecuenciaLabel,
    sesionesMes,
    precioMensual: precio.total,
    precioTexto: precio.disponible ? fmtCOP(precio.total) : 'Por confirmar',
    etiqueta,
    tipoLabel: sel.tipo ? TIPO_LABEL[sel.tipo] : '',
  }
}

// ── Roster compartido (se reemplaza por Firestore) ──
// Los mismos atletas y planes aparecen en el portal del entrenador,
// el directorio admin y el ranking del alumno.
export interface AtletaRoster {
  id: string
  nombre: string
  plan: PlanAsignado
  entrenador: string
  asistidas: number     // sesiones asistidas del mes
  documento: string
  estadoCuenta: 'Activo' | 'Suspendido'
}

const HOY_DESDE = '03 Jul 2026'
const PROX_PAGO = '03 Ago 2026'

export const ROSTER: AtletaRoster[] = [
  {
    id: 'FR-0922', nombre: 'Carlos Méndez', entrenador: 'Ana Torres', asistidas: 6,
    documento: 'C.C. 1.088.301.457', estadoCuenta: 'Activo',
    plan: { tipo: 'grupal', grupoId: 'knowill', personalId: null, conjuntoId: null, week: 2, personas: 1, ninos: 0, estado: 'activo', desde: HOY_DESDE, proximoPago: PROX_PAGO, dias: [{ dow: 2, hora: '6:00 PM' }, { dow: 4, hora: '6:00 PM' }] },
  },
  {
    id: 'FR-1045', nombre: 'Sofía Ruiz', entrenador: 'Ana Torres', asistidas: 11,
    documento: 'C.C. 1.088.442.190', estadoCuenta: 'Activo',
    plan: { tipo: 'grupal', grupoId: 'knowill', personalId: null, conjuntoId: null, week: 3, personas: 1, ninos: 0, estado: 'activo', desde: HOY_DESDE, proximoPago: PROX_PAGO },
  },
  {
    id: 'FR-0871', nombre: 'Diego Morales', entrenador: 'Ana Torres', asistidas: 7,
    documento: 'C.C. 1.089.110.774', estadoCuenta: 'Activo',
    plan: { tipo: 'personal', grupoId: null, personalId: 'individual', conjuntoId: null, week: 2, personas: 1, ninos: 0, estado: 'activo', desde: HOY_DESDE, proximoPago: PROX_PAGO },
  },
  {
    id: 'FR-1198', nombre: 'Valentina Castro', entrenador: 'Felipe Cárdenas', asistidas: 3,
    documento: 'C.C. 1.092.663.028', estadoCuenta: 'Activo',
    plan: { tipo: 'grupal', grupoId: 'estrellas', personalId: null, conjuntoId: null, week: 1, personas: 1, ninos: 0, estado: 'activo', desde: HOY_DESDE, proximoPago: PROX_PAGO },
  },
  {
    id: 'FR-0634', nombre: 'Andrés Rojas', entrenador: 'Ana Torres', asistidas: 2,
    documento: 'T.I. 1.011.556.201', estadoCuenta: 'Suspendido',
    plan: { tipo: 'personal', grupoId: null, personalId: 'pareja', conjuntoId: null, week: 2, personas: 2, ninos: 0, estado: 'vencido', desde: '01 Jun 2026', proximoPago: 'Vencido' },
  },
  {
    id: 'FR-1302', nombre: 'Mariana Duque', entrenador: 'Felipe Cárdenas', asistidas: 8,
    documento: 'C.C. 1.093.008.771', estadoCuenta: 'Activo',
    plan: { tipo: 'conjunto', grupoId: null, personalId: null, conjuntoId: 'nat-acuagym', week: 2, personas: 1, ninos: 0, estado: 'activo', desde: HOY_DESDE, proximoPago: PROX_PAGO },
  },
]

/** Porcentaje de asistencia del mes según las sesiones que paga su plan. */
export function pctAsistencia(a: AtletaRoster): number {
  const { sesionesMes } = describirPlan(a.plan)
  if (!sesionesMes) return 0
  return Math.min(100, Math.round((a.asistidas / sesionesMes) * 100))
}
