// ============================================================
// FAROS — Cache de "última data buena" para modo offline
// Firestore no tiene persistencia offline habilitada en este proyecto
// (getFirebase() no llama enableIndexedDbPersistence) — sin conexión,
// cualquier getDoc/getDocs falla directo. Esto guarda la última
// respuesta exitosa para poder mostrar algo en vez de una pantalla en
// blanco cuando el usuario abre la app sin señal.
// ============================================================

const PREFIJO = 'faros-cache-'

export function guardarCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(PREFIJO + key, JSON.stringify({ data, guardadoEn: Date.now() }))
  } catch {}
}

export function leerCache<T>(key: string): { data: T; guardadoEn: number } | null {
  try {
    const raw = localStorage.getItem(PREFIJO + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
