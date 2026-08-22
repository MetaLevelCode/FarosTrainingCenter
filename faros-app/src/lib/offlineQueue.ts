// ============================================================
// FAROS — Cola de acciones offline (profesor sin cobertura)
// Background Sync API no existe en iOS Safari, así que en vez de
// depender de eso usamos algo que funciona en todas partes: guardar
// la acción en localStorage y reintentarla cuando vuelve `online`
// (evento estándar, soportado en todos los navegadores).
// ============================================================

export interface AccionAsistencia {
  id: string
  tipo: 'asistencia'
  claseId: string
  usuarioId: string
  asistio: boolean
  profesorId: string
  creadoEn: number
}

const KEY = 'faros-offline-queue'

function leerCola(): AccionAsistencia[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function guardarCola(cola: AccionAsistencia[]) {
  try { localStorage.setItem(KEY, JSON.stringify(cola)) } catch {}
}

/** Encola una marca de asistencia para sincronizar después. */
export function encolarAsistencia(payload: Omit<AccionAsistencia, 'id' | 'tipo' | 'creadoEn'>): void {
  const cola = leerCola()
  cola.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo: 'asistencia',
    creadoEn: Date.now(),
    ...payload,
  })
  guardarCola(cola)
}

export function cantidadPendientes(): number {
  return leerCola().length
}

/**
 * Reintenta cada acción encolada. Las que fallan (ej. sigue sin señal)
 * quedan en la cola para el próximo intento; las que sí funcionan salen.
 */
export async function sincronizarCola(
  registrarAsistenciaFn: (claseId: string, usuarioId: string, asistio: boolean, profesorId: string) => Promise<void>,
): Promise<{ ok: number; fallidas: number }> {
  const cola = leerCola()
  if (cola.length === 0) return { ok: 0, fallidas: 0 }

  const restantes: AccionAsistencia[] = []
  let ok = 0
  for (const accion of cola) {
    try {
      await registrarAsistenciaFn(accion.claseId, accion.usuarioId, accion.asistio, accion.profesorId)
      ok++
    } catch {
      restantes.push(accion)
    }
  }
  guardarCola(restantes)
  return { ok, fallidas: restantes.length }
}
