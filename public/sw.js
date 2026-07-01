// Bump CACHE_NAME on any change here so `activate` purges older caches.
const CACHE_NAME = 'stillpoint-cis-v2'

self.addEventListener('install', () => {
  // Activate this new worker immediately so a fresh deploy applies on the next load
  // (rather than waiting for every tab to close first).
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and API requests (never cache mutations or data reads).
  if (request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return

  // App code and icons are content-hashed and immutable, so cache-first is safe and fast:
  // a new deploy ships new filenames, which miss the cache and fetch fresh automatically.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            return response
          }),
      ),
    )
    return
  }

  // Everything else (documents, RSC payloads, other GETs): NETWORK-FIRST so a normal
  // refresh always shows the latest deploy. The cache is only a fallback when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
      .catch(() => caches.match(request)),
  )
})
