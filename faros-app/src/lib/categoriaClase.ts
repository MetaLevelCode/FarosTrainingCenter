// ============================================================
// FAROS — Categoría de una Clase (agrupación en listas largas)
// Con clases recurrentes (grupales semanales + personalizadas) la
// lista de "mis clases" de un profesor o alumno crece rápido — esto
// agrupa por catalogo_codigo para mostrar solo la más próxima suelta
// y el resto colapsado por categoría.
// ============================================================

import type { Clase } from './types'

const CATEGORIA_LABEL: Record<string, string> = {
  'estrellas-utp': 'Estrellas',
  'knowill-vip': 'Tiburón',
  'tulcan-ii': 'Tulcán',
  personalizada: 'Personalizada',
}

export function labelCategoria(codigo: string): string {
  return CATEGORIA_LABEL[codigo] ?? codigo
}

export function agruparPorCategoria(clases: Clase[]): Map<string, Clase[]> {
  const m = new Map<string, Clase[]>()
  for (const c of clases) {
    const arr = m.get(c.catalogo_codigo) ?? []
    arr.push(c)
    m.set(c.catalogo_codigo, arr)
  }
  return m
}

/** La clase en curso, o si no hay ninguna, la próxima programada. */
export function proximaClase(clases: Clase[]): Clase | null {
  const ahora = Date.now()
  const enCurso = clases.find((c) => c.estado === 'en_curso')
  if (enCurso) return enCurso
  const futuras = clases
    .filter((c) => c.estado === 'programada' && c.fecha_hora_inicio >= ahora)
    .sort((a, b) => a.fecha_hora_inicio - b.fecha_hora_inicio)
  return futuras[0] ?? null
}
