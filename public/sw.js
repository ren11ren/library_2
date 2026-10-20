const CACHE_NAME = 'library-management-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(['/offline.html', '/', '/index.html']))
    )
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    )
    self.clients.claim()
})

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return

    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const networkResponse = await fetch(event.request)
                    const cache = await caches.open(CACHE_NAME)
                    cache.put(event.request, networkResponse.clone())
                    return networkResponse
                } catch (error) {
                    const cachedPage = await caches.match(event.request)
                    if (cachedPage) return cachedPage
                    return caches.match(OFFLINE_URL) || Response.redirect('/')
                }
            })()
        )
        return
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached

            return fetch(event.request)
                .then((networkResponse) => {
                    const cloned = networkResponse.clone()
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned))
                    return networkResponse
                })
                .catch(() => caches.match(OFFLINE_URL))
        })
    )
})
