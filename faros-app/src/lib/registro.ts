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
// SEGURIDAD: estas validaciones son de CLIENTE — sirven para guiar al
// usuario, no para autorizar. Cualquiera puede saltárselas con las
// herramientas del navegador. Las mismas reglas (mayoría de edad del
// entrenador, acudiente del menor, código de un solo uso) tienen que
// repetirse en el servidor, que es donde de verdad se hacen cumplir.
// ============================================================

/**
 * Tipo de documento. Vive aquí y no en types.ts porque solo importa
 * durante el REGISTRO: es lo que permite cruzar documento con edad
 * (T.I. es de menor, C.C. de mayor, C.E. de cualquiera). Una vez
 * creado el usuario, el modelo guarda únicamente `cedula`.
 */
export type TipoDocumento = 'TI' | 'CC' | 'CE'

export type TipoRegistro = 'alumno' | 'entrenador'

// ── Códigos de invitación para entrenadores ──
export interface CodigoInvitacion {
  codigo: string
  creadoPor: string      // nombre del admin que lo emitió
  creadoEn: string
  usadoPor?: string      // correo de quien lo consumió
  usadoEn?: string
}

const ES_DEV = process.env.NODE_ENV !== 'production'

/** Forma de un código válido. Sirve para dar respuesta inmediata sin
 *  conocer los códigos reales. */
const FORMATO_CODIGO = /^FAROS-COACH-[A-Z0-9]{4}$/

// Semilla de demostración: SOLO en desarrollo.
//
// SEGURIDAD: todo lo que vive en src/ se compila dentro del JavaScript
// que se envía al navegador. Si los códigos reales estuvieran aquí,
// cualquiera podría abrir el bundle, leerlos y registrarse como
// entrenador. En producción esta lista queda vacía y la comprobación
// de verdad la hace el servidor (ver verificarCodigoEnServidor).
const CODIGOS: CodigoInvitacion[] = ES_DEV ? [
  { codigo: 'FAROS-COACH-7K2M', creadoPor: 'Luis Faros', creadoEn: '20 Jul 2026' },
  { codigo: 'FAROS-COACH-4RQ9', creadoPor: 'Luis Faros', creadoEn: '22 Jul 2026' },
  { codigo: 'FAROS-COACH-8XT1', creadoPor: 'Luis Faros', creadoEn: '10 Jul 2026', usadoPor: 'entrenador@faros.com', usadoEn: '11 Jul 2026' },
] : []

export function listarCodigos(): CodigoInvitacion[] {
  return [...CODIGOS]
}

/**
 * Genera un código para la DEMO. En producción debe generarlo el
 * servidor: Math.random no es criptográficamente seguro (su secuencia
 * es predecible) y un código emitido solo en el navegador no existiría
 * para nadie más.
 */
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

/**
 * Comprobación de CLIENTE: sirve para dar retroalimentación inmediata
 * en el formulario, NO para autorizar.
 *
 * En producción solo valida el formato, porque el navegador no puede
 * (ni debe) saber qué códigos existen. Que aquí dé `valido` no significa
 * que el registro vaya a proceder: la palabra final es del servidor,
 * que verifica y consume el código en una sola operación atómica.
 */
export function validarCodigo(codigo: string): ResultadoCodigo {
  const limpio = codigo.trim().toUpperCase()
  if (!limpio) return { valido: false, motivo: 'vacio' }
  if (!FORMATO_CODIGO.test(limpio)) return { valido: false, motivo: 'inexistente' }

  // Producción: sin la lista real, solo se pudo validar el formato.
  if (!ES_DEV) return { valido: true }

  // Demo local: se contrasta contra la semilla en memoria.
  const encontrado = CODIGOS.find((c) => c.codigo === limpio)
  if (!encontrado) return { valido: false, motivo: 'inexistente' }
  if (encontrado.usadoPor) return { valido: false, motivo: 'usado' }
  return { valido: true }
}

/**
 * Verificación REAL del código vía API Route (POST /api/invitaciones).
 * El check y el consumo ocurren en una transacción Firestore server-side,
 * garantizando que dos personas no puedan usar el mismo código a la vez.
 */
export async function verificarCodigoEnServidor(
  codigo: string, correo: string,
): Promise<ResultadoCodigo> {
  const res = await fetch('/api/invitaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo, correo }),
  })
  if (!res.ok) throw new Error('Error al verificar el código en el servidor')
  const data = await res.json() as ResultadoCodigo | { error: string }
  if ('error' in data) throw new Error(data.error)
  return data
}

/**
 * Marca el código como consumido EN LA DEMO local. En producción esto
 * lo hace el servidor: si se dejara al cliente, bastaría con no llamarlo
 * para reutilizar un código infinitas veces.
 */
export function consumirCodigo(codigo: string, correo: string): boolean {
  if (!ES_DEV) return false
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
