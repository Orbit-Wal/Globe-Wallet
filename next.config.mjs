import { validateEnvironment } from './lib/env.mjs'
import createNextIntlPlugin from 'next-intl/plugin'

validateEnvironment()

const withNextIntl = createNextIntlPlugin('./i18n.ts')

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
  // uint8array-extras is an ESM-only transitive dependency of
  // @stellar/stellar-sdk's webauth module (its root barrel export loads it
  // eagerly). Needed since Issue #63 made app/api/wallet/send/route.ts
  // import directly from the SDK — next/jest derives its Jest
  // transformIgnorePatterns allowlist from this array, so this also fixes
  // `npm test` for any route/module importing the SDK directly.
  transpilePackages: ['@stellar/stellar-sdk', '@noble/hashes', '@noble/ed25519', '@noble/curves', '@scure/base', 'uint8array-extras'],
}

export default withNextIntl(nextConfig)
