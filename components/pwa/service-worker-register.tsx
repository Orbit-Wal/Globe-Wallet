'use client'

import { useEffect } from 'react'

/**
 * Issue #94 — registers /sw.js so the app has an offline fallback shell and
 * caches last-fetched balance/transaction data. Skipped outside production:
 * a service worker intercepting fetches during local dev fights Fast
 * Refresh / Turbopack's own asset invalidation and makes changes appear to
 * not take effect.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: the app still works online without the service worker,
      // it just loses the offline fallback/caching behavior.
    })
  }, [])

  return null
}
