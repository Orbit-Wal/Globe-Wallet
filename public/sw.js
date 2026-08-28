// Issue #94 — minimal hand-rolled service worker.
//
// This repo is on Next 16 (App Router) and does not have next-pwa or a
// similar plugin installed. next-pwa's webpack-plugin/Workbox pipeline
// doesn't have confirmed first-class support for Next 16 / Turbopack, and
// this change can't run `next build` to verify a generated Workbox output
// actually works — so a small, dependency-free hand-written worker is the
// lower-risk way to satisfy this issue's DoD (offline fallback shell +
// cached last-fetched wallet data) without gambling on a build-time
// integration nobody can verify here. Swapping this for next-pwa later is a
// drop-in replacement if the project wants Workbox's extra features.

const CACHE_VERSION = 'v1'
const SHELL_CACHE = `globe-wallet-shell-${CACHE_VERSION}`
const DATA_CACHE = `globe-wallet-data-${CACHE_VERSION}`

// Precached app-shell assets needed to render the offline fallback page.
const SHELL_ASSETS = ['/offline.html', '/manifest.json', '/icon.svg', '/icon-light-32x32.png', '/icon-dark-32x32.png']

// Same-origin GET API routes whose last successful response should stay
// available offline — balances + transaction history, per this issue's DoD.
const CACHEABLE_API_PATHS = ['/api/wallet/balances', '/api/wallet/transactions']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => {
        // Best-effort precache; a failed asset here shouldn't block install.
      }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isCacheableApiRequest(url) {
  return CACHEABLE_API_PATHS.some((path) => url.pathname.startsWith(path))
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle same-origin GETs; POSTs (send, off-ramp submission, etc.)
  // are left to the network so a failure surfaces to the app instead of
  // being swallowed/served-stale by the worker.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Page navigations: try the network first, fall back to a cached copy,
  // and finally to the offline shell — never a blank browser error page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/offline.html')),
      ),
    )
    return
  }

  // Wallet balance/transaction data: network-first so it's always fresh
  // when online, caching each successful response so the last-known state
  // is servable when offline.
  if (isCacheableApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone()
          caches
            .open(DATA_CACHE)
            .then((cache) => cache.put(request, responseClone))
            .catch(() => {})
          return response
        })
        .catch(() => caches.match(request)),
    )
    return
  }

  // Everything else (static assets, icons, etc.): cache-first, network as
  // a fallback for anything not yet cached.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached)),
  )
})
