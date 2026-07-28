// ============================================================
// FAROS — Reglas de registro
// Quién puede registrarse, con qué datos y bajo qué condiciones.
//
// Dos caminos:
//  · Alumno    → registro abierto.
//  · Entrenador→ exige un CÓDIGO DE UN SOLO USO emitido por un
//                admin ya registrado.
//
// Documento y edad van atados: T.I. es de menor de edad y C.C. de
// mayor. Un menor requiere acudiente, por eso el contacto de
// emergencia deja de ser opcional en ese caso.
//
// Los códigos viven en memoria mientras no haya Firestore; la
// interfaz ya puede construirse contra estas funciones.
// ============================================================

import type { TipoDocumento } from './types'

export type TipoRegistro = 'alumno' | 'entrenador'

// ── Códigos de invitación para entrenadores ──
export interface CodigoInvitacion {
  codigo: string
  creadoPor: string      // nombre del admin que lo emitió
  creadoEn: string
  usadoPor?: string      // correo de quien lo consumió
  usadoEn?: string
}

// Semilla de demostración (se reemplaza por Firestore).
const CODIGOS: CodigoInvitacion[] = [
  { codigo: 'FAROS-COACH-7K2M', creadoPor: 'Luis Faros', creadoEn: '20 Jul 2026' },
  { codigo: 'FAROS-COACH-4RQ9', creadoPor: 'Luis Faros', creadoEn: '22 Jul 2026' },
  { codigo: 'FAROS-COACH-8XT1', creadoPor: 'Luis Faros', creadoEn: '10 Jul 2026', usadoPor: 'entrenador@faros.com', usadoEn: '11 Jul 2026' },
]

export function listarCodigos(): CodigoInvitacion[] {
  return [...CODIGOS]
}

/** Genera un código nuevo. Sólo debería invocarse desde el panel admin. */
export function generarCodigo(creadoPor: string): CodigoInvitacion {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin I/O/0/1: se confunden al dictarlos
  let sufijo = ''
  for (let i = 0; i < 4; i++) {
    sufijo += alfabeto[Math.floor(Math.random() * alfabeto.length)]
  }
  const nuevo: CodigoInvitacion = {
    codigo: `FAROS-COACH-${sufijo}`,
    creadoPor,
    creadoEn: new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()),
  }
  CODIGOS.push(nuevo)
  return nuevo
}

export type ResultadoCodigo =
  | { valido: true }
  | { valido: false; motivo: 'vacio' | 'inexistente' | 'usado' }

export function validarCodigo(codigo: string): ResultadoCodigo {
  const limpio = codigo.trim().toUpperCase()
  if (!limpio) return { valido: false, motivo: 'vacio' }
  const encontrado = CODIGOS.find((c) => c.codigo === limpio)
  if (!encontrado) return { valido: false, motivo: 'inexistente' }
  if (encontrado.usadoPor) return { valido: false, motivo: 'usado' }
  return { valido: true }
}

/** Marca el código como consumido. Un código no se reutiliza jamás. */
export function consumirCodigo(codigo: string, correo: string): boolean {
  const limpio = codigo.trim().toUpperCase()
  const encontrado = CODIGOS.find((c) => c.codigo === limpio && !c.usadoPor)
  if (!encontrado) return false
  encontrado.usadoPor = correo
  encontrado.usadoEn = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())
  return true
}

export const MENSAJE_CODIGO: Record<'vacio' | 'inexistente' | 'usado', string> = {
  vacio: 'Escribe el código que te dio la administración.',
  inexistente: 'Ese código no existe. Revísalo con quien te lo entregó.',
  usado: 'Ese código ya fue utilizado. Pide uno nuevo a la administración.',
}

// ── Edad y documento ──

/** Años cumplidos a partir de una fecha ISO (YYYY-MM-DD). */
export function calcularEdad(fechaISO: string): number | null {
  const f = new Date(fechaISO)
  if (Number.isNaN(f.getTime())) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - f.getFullYear()
  const m = hoy.getMonth() - f.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < f.getDate())) edad--
  return edad
}

export function esMenorDeEdad(fechaISO: string): boolean {
  const edad = calcularEdad(fechaISO)
  return edad !== null && edad < 18
}

/**
 * El tipo de documento debe concordar con la edad: T.I. para menores,
 * C.C. para mayores. La C.E. aplica a extranjeros de cualquier edad.
 */
export function documentoCoherente(tipo: TipoDocumento, fechaISO: string): { ok: true } | { ok: false; mensaje: string } {
  if (tipo === 'CE') return { ok: true }
  const edad = calcularEdad(fechaISO)
  if (edad === null) return { ok: false, mensaje: 'Revisa la fecha de nacimiento.' }
  if (tipo === 'TI' && edad >= 18) {
    return { ok: false, mensaje: 'Con 18 años o más el documento debe ser cédula de ciudadanía.' }
  }
  if (tipo === 'CC' && edad < 18) {
    return { ok: false, mensaje: 'Siendo menor de edad el documento debe ser tarjeta de identidad.' }
  }
  return { ok: true }
}

/** Un menor de edad no puede inscribirse sin acudiente responsable. */
export function requiereAcudiente(fechaISO: string): boolean {
  return esMenorDeEdad(fechaISO)
}

/** Los entrenadores deben ser mayores de edad. */
export function puedeSerEntrenador(fechaISO: string): { ok: true } | { ok: false; mensaje: string } {
  const edad = calcularEdad(fechaISO)
  if (edad === null) return { ok: false, mensaje: 'Revisa la fecha de nacimiento.' }
  if (edad < 18) return { ok: false, mensaje: 'El registro de entrenadores es sólo para mayores de edad.' }
  return { ok: true }
}

// ── Datos que pide cada camino ──

export interface DatosRegistro {
  // Cuenta
  correo: string
  password: string
  // Identidad (estándar Colombia)
  nombreCompleto: string
  tipoDocumento: TipoDocumento
  documento: string
  fechaNacimiento: string   // ISO YYYY-MM-DD
  genero: string
  telefono: string
  ciudad: string
  departamento: string
  // Salud y seguridad
  eps: string
  rh: string
  contactoEmergencia: { nombre: string; parentesco: string; telefono: string }
  // Sólo entrenador
  codigoInvitacion?: string
  especialidad?: string
  experiencia?: string
  certificacion?: string
  // Legal
  aceptaTerminos: boolean
}

/**
 * Valida el conjunto según el camino elegido. Devuelve los campos con
 * problema para que el formulario los marque uno a uno.
 */
export function validarRegistro(tipo: TipoRegistro, d: Partial<DatosRegistro>): Record<string, string> {
  const e: Record<string, string> = {}

  if (!d.correo?.includes('@')) e.correo = 'Escribe un correo válido.'
  if (!d.password || d.password.length < 6) e.password = 'Mínimo 6 caracteres.'
  if (!d.nombreCompleto?.trim()) e.nombreCompleto = 'Escribe tu nombre completo.'
  if (!d.documento?.trim()) e.documento = 'Escribe tu número de documento.'
  if (!d.fechaNacimiento) e.fechaNacimiento = 'Indica tu fecha de nacimiento.'
  if (!d.telefono?.trim()) e.telefono = 'Escribe un número de contacto.'
  if (!d.ciudad?.trim()) e.ciudad = 'Indica tu ciudad.'
  if (!d.eps?.trim()) e.eps = 'Indica tu EPS.'
  if (!d.rh?.trim()) e.rh = 'Indica tu grupo sanguíneo.'

  if (d.tipoDocumento && d.fechaNacimiento) {
    const coherencia = documentoCoherente(d.tipoDocumento, d.fechaNacimiento)
    if (!coherencia.ok) e.tipoDocumento = coherencia.mensaje
  }

  // Menor de edad: el acudiente es obligatorio.
  if (d.fechaNacimiento && requiereAcudiente(d.fechaNacimiento)) {
    if (!d.contactoEmergencia?.nombre?.trim() || !d.contactoEmergencia?.telefono?.trim()) {
      e.contactoEmergencia = 'Siendo menor de edad, los datos del acudiente son obligatorios.'
    }
  }

  if (tipo === 'entrenador') {
    const cod = validarCodigo(d.codigoInvitacion ?? '')
    if (!cod.valido) e.codigoInvitacion = MENSAJE_CODIGO[cod.motivo]
    if (d.fechaNacimiento) {
      const mayor = puedeSerEntrenador(d.fechaNacimiento)
      if (!mayor.ok) e.fechaNacimiento = mayor.mensaje
    }
    if (!d.especialidad?.trim()) e.especialidad = 'Indica tu especialidad.'
    if (!d.certificacion?.trim()) e.certificacion = 'Indica tu certificación.'
  }

  if (!d.aceptaTerminos) e.aceptaTerminos = 'Debes aceptar los términos y condiciones.'

  return e
}
