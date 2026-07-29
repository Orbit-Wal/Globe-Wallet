'use client'

import { initTracing, isTracingInitialized } from './tracer'

/**
 * Issue #103 — browser-side tracer bootstrap.
 *
 * Imported once, for its side effect, from app/layout.tsx. Module-scope code
 * in a 'use client' file runs as soon as the browser evaluates the chunk —
 * before any component mounts — so every client-side BaseService call and
 * the WalletService.sendPayment fetch produce real spans instead of running
 * against the API's no-op default. Exports to the console by default; swap
 * in a real exporter here once a collector endpoint exists for the browser.
 */
if (typeof window !== 'undefined' && !isTracingInitialized()) {
  initTracing()
}
