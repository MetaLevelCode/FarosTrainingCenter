// ============================================================
// FAROS Training — Service Worker
// Strategy per resource type:
//   · Navigations (HTML) ......... network-first → cache → /offline
//   · /_next/static (hashed) ..... cache-first (immutable)
//   · Images / media / fonts ..... stale-while-revalidate (capped)
//   · Google Fonts ............... cache-first (fonts rarely change)
//   · Firebase / APIs ............ never intercepted
// Bump VERSION on every deploy that should invalidate caches.
// ============================================================
const VERSION = 'faros-v11'
const PRECACHE = `${VERSION}-precache`
const RUNTIME = `${VERSION}-runtime`
const MEDIA = `${VERSION}-media`
const MEDIA_MAX_ENTRIES = 60

const PRECACHE_URLS = ['/', '/login', '/offline', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']

// Último recurso absoluto si ni el cache de la navegación ni /offline
// están disponibles — nunca dejar que el navegador muestre su propia
// pantalla nativa de "sin conexión" (el dinosaurio de Chrome).
const FALLBACK_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión — Faros Training</title>
<style>
  body{margin:0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:16px;background:#050505;color:#f5f5f5;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:24px}
  h1{font-size:15px;letter-spacing:.15em;text-transform:uppercase;color:#e6ff00;margin:0}
  p{font-size:13px;color:rgba(245,245,245,.7);margin:0;max-width:320px}
  button{margin-top:8px;padding:10px 24px;border-radius:999px;border:none;
    background:#e6ff00;color:#050505;font-weight:700;font-size:13px}
</style></head><body>
  <h1>Sin conexión</h1>
  <p>No hay datos guardados de esta página todavía. Conéctate y vuelve a intentar.</p>
  <button onclick="location.reload()">Reintentar</button>
</body></html>`

const NEVER_CACHE_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
]

// Google Fonts (incluye el font de Material Symbols que usan los
// íconos de toda la app) — cache-first, ver más abajo. connect-src
// en next.config.mjs ya las autoriza para que el fetch() del SW no
// choque con CSP. Sin este cache, dependían del cache HTTP nativo del
// navegador, que en iOS (sobre todo instalado como PWA) es mucho
// menos confiable: sin señal, el font no cargaba y los íconos se
// veían como texto plano ("event_busy" en vez del glifo).
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(PRECACHE)
      // addAll() es todo-o-nada: si UNA sola URL falla, ninguna queda
      // cacheada — incluida /offline, el propio fallback. allSettled +
      // add() individual hace que un solo tropiezo no tumbe el resto.
      .then((c) => Promise.allSettled(PRECACHE_URLS.map((url) => c.add(url))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  await cache.delete(keys[0])
  return trimCache(cacheName, maxEntries)
}

async function networkFirstPage(request) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const cache = await caches.open(RUNTIME)
      cache.put(request, res.clone())
    }
    return res
  } catch {
    // ignoreVary/ignoreSearch: una navegación real trae headers propios
    // de Next (rsc, next-router-state-tree...) que no estaban presentes
    // cuando el SW cacheó estas URLs con un fetch/add plano — sin esto,
    // una respuesta cacheada con Vary podía no calzar y el fallback
    // caía al último recurso sin necesidad.
    const cached = await caches.match(request, { ignoreVary: true, ignoreSearch: true })
    if (cached) return cached
    const offline = await caches.match('/offline', { ignoreVary: true })
    if (offline) return offline
    return new Response(FALLBACK_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const res = await fetch(request)
    if (res.ok || res.type === 'opaque') {
      const cache = await caches.open(cacheName)
      cache.put(request, res.clone())
    }
    return res
  } catch {
    // Si el fetch fue bloqueado (CSP, red caída), devolver un 504 en vez
    // de propagar la excepción — evita 'Failed to convert value to Response'.
    return new Response('', { status: 504, statusText: 'Gateway Timeout' })
  }
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cached = await caches.match(request)
  const network = fetch(request)
    .then(async (res) => {
      if (res.ok || res.type === 'opaque') {
        const cache = await caches.open(cacheName)
        await cache.put(request, res.clone())
        if (maxEntries) trimCache(cacheName, maxEntries)
      }
      return res
    })
    .catch(() => cached ?? new Response('', { status: 504, statusText: 'Gateway Timeout' }))
  return cached || network
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never touch auth/data APIs — they must always hit the network.
  if (NEVER_CACHE_HOSTS.some((h) => url.hostname === h)) return

  // Google Fonts (Material Symbols incluido) — cache-first, casi nunca
  // cambian de contenido.
  if (FONT_HOSTS.some((h) => url.hostname === h)) {
    e.respondWith(cacheFirst(request, RUNTIME))
    return
  }

  // Page navigations
  if (request.mode === 'navigate') {
    e.respondWith(networkFirstPage(request))
    return
  }

  // Hashed build assets: immutable
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    e.respondWith(cacheFirst(request, RUNTIME))
    return
  }

  // Same-origin images / media / icons
  if (
    url.origin === self.location.origin &&
    (request.destination === 'image' ||
      request.destination === 'video' ||
      url.pathname.startsWith('/media/') ||
      url.pathname.startsWith('/icons/'))
  ) {
    e.respondWith(staleWhileRevalidate(request, MEDIA, MEDIA_MAX_ENTRIES))
    return
  }

  // Anything else (RSC payloads, JSON, un-hashed dev assets) goes
  // straight to the network: caching those causes stale-JS-vs-fresh-HTML
  // hydration mismatches after each deploy.
})
