import { validateEnvironment } from './lib/env.mjs'
import createNextIntlPlugin from 'next-intl/plugin'

validateEnvironment()

// createNextIntlPlugin() with no argument looks for the default
// ./i18n/request.ts path; this repo's request-config module lives at
// ./i18n.ts instead, so it must be passed explicitly or `next build` fails
// outright ("Could not locate request configuration module").
const withNextIntl = createNextIntlPlugin('./i18n.ts')

// Issue #82 — Content-Security-Policy and standard security headers.
//
// script-src/style-src need 'unsafe-inline' because next/font and the App
// Router both inject inline <script>/<style> tags with no nonce wiring in
// this codebase; 'unsafe-eval' is dev-only, required by webpack/Turbopack's
// eval-based source maps and Fast Refresh (never present in production).
//
// connect-src is scoped to origins the *browser* actually calls directly —
// server-side fetches (Horizon, Soroban RPC, the EVM RPCs added for Base/
// Ethereum support, etc.) run in API routes and aren't subject to the
// page's CSP at all:
//   - api.coingecko.com: lib/services/rates.service.ts is imported directly
//     into the 'use client' convert page and fetches live rates from the
//     browser, not through an API route proxy
//   - horizon-testnet.stellar.org / horizon.stellar.org: defensive — no
//     current client component calls Horizon directly (sendPayment goes
//     through /api/wallet/send), but NEXT_PUBLIC_STELLAR_NETWORK can select
//     either network at runtime and nothing prevents a future client-side
//     read call, so both are allowlisted up front rather than silently
//     breaking if one gets added
//   - va.vercel-scripts.com / vitals.vercel-insights.com: @vercel/analytics
//     in app/[locale]/layout.tsx. This package no-ops outside Vercel's own
//     platform (so it's inert during local dev/self-hosted verification),
//     but a real Vercel deployment needs these unblocked or Analytics
//     silently stops reporting
const isDev = process.env.NODE_ENV === 'development'
const contentSecurityPolicy = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? ` 'unsafe-eval'` : ''} https://va.vercel-scripts.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://api.coingecko.com https://horizon-testnet.stellar.org https://horizon.stellar.org https://vitals.vercel-insights.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  // uint8array-extras is an ESM-only transitive dependency of
  // @stellar/stellar-sdk's webauth module (its root barrel export loads it
  // eagerly). Needed since Issue #63 made app/api/wallet/send/route.ts
  // import directly from the SDK — next/jest derives its Jest
  // transformIgnorePatterns allowlist from this array, so this also fixes
  // `npm test` for any route/module importing the SDK directly.
  transpilePackages: ['@stellar/stellar-sdk', '@noble/hashes', '@noble/ed25519', '@noble/curves', '@scure/base', 'uint8array-extras'],
}

export default withNextIntl(nextConfig)
