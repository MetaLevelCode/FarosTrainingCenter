// FAROS Training — Service Worker
const CACHE = 'faros-v1'
const OFFLINE_URLS = ['/', '/login', '/manifest.json']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_URLS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  // Network-first for pages, cache fallback
  if (request.headers.get('Accept')?.includes('text/html')) {
    e.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match('/login')))
    )
    return
  }
  // Cache-first for assets
  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(request, clone))
        return res
      }).catch(() => cached)
    )
  )
})
