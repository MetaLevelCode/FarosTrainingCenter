// ============================================================
// FAROS — Rate limiter in-memory por IP + endpoint
// Ventana deslizante simple: N requests permitidos cada windowMs ms.
// Persiste mientras la instancia esté caliente. En Cloud Run con
// múltiples instancias es imperfecto pero suficiente para frenar
// bots casuales y brute-force básico.
// ============================================================

import type { NextRequest } from 'next/server'

interface Entry { count: number; resetAt: number }

const buckets = new Map<string, Entry>()

// Limpieza opcional: cada 5 min purga entradas expiradas
let lastSweep = 0
function sweep() {
  const now = Date.now()
  if (now - lastSweep < 5 * 60_000) return
  lastSweep = now
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k)
}

/**
 * Extrae la IP del request. En App Hosting / Cloud Run el header real
 * es X-Forwarded-For (primera IP de la lista es la del cliente).
 */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * Aplica rate limit. Devuelve `null` si está OK o un `Response` 429 si
 * se pasó del límite. Uso:
 *   const limited = rateLimit(req, 'invitaciones', { max: 5, windowMs: 60_000 })
 *   if (limited) return limited
 */
export function rateLimit(
  req: NextRequest,
  scope: string,
  opts: { max: number; windowMs: number },
): Response | null {
  sweep()
  const key = `${scope}:${clientIp(req)}`
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    return null
  }

  entry.count++
  if (entry.count > opts.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return new Response(
      JSON.stringify({ error: 'Demasiadas solicitudes. Intenta en un momento.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      },
    )
  }
  return null
}
