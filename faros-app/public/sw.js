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
const VERSION = 'faros-v2'
const PRECACHE = `${VERSION}-precache`
const RUNTIME = `${VERSION}-runtime`
const MEDIA = `${VERSION}-media`
const MEDIA_MAX_ENTRIES = 60

const PRECACHE_URLS = ['/', '/login', '/offline', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']

const NEVER_CACHE_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(PRECACHE)
      .then((c) => c.addAll(PRECACHE_URLS))
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
    const cached = await caches.match(request)
    if (cached) return cached
    const offline = await caches.match('/offline')
    return offline || Response.error()
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok || res.type === 'opaque') {
    const cache = await caches.open(cacheName)
    cache.put(request, res.clone())
  }
  return res
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
    .catch(() => cached)
  return cached || network
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never touch auth/data APIs — they must always hit the network.
  if (NEVER_CACHE_HOSTS.some((h) => url.hostname === h)) return

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

  // Google Fonts (css + woff2)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
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

  // Everything else same-origin: stale-while-revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(staleWhileRevalidate(request, RUNTIME))
  }
})
