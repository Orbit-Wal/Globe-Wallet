// Next loads next.config.mjs while creating its Jest configuration. Supply the
// non-secret testnet defaults required by startup validation for test runs.
process.env.NEXT_PUBLIC_STELLAR_NETWORK ??= 'testnet'
process.env.STELLAR_HORIZON_URL ??= 'https://horizon-testnet.stellar.org'

const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // jest-environment-jsdom doesn't provide fetch/Request/Response/Headers at
  // all (not even via Node's globals — jsdom runs in its own VM sandbox).
  // jest-fixed-jsdom is the same environment with those bridged back in from
  // the real Node runtime, needed by tests that jest.spyOn(global, 'fetch').
  testEnvironment: 'jest-fixed-jsdom',
  coverageProvider: 'v8',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/tests/e2e/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    // Kept in sync with next.config.mjs's transpilePackages (uint8array-extras
    // added there for Issue #63 — see the comment on that array). next-intl and
    // use-intl ship ESM-only builds and need transforming too.
    '/node_modules/(?!(@stellar/stellar-sdk|@noble|@stellar|uint8array-extras|next-intl|use-intl|@formatjs|intl-messageformat)/)',
  ],
  moduleNameMapper: {
    '^.+\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'app/api/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    'lib/fixtures/factory.ts': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'lib/transaction-utils.ts': {
      branches: 60,
      functions: 85,
      lines: 80,
      statements: 80,
    },
    'hooks/useTransactions.ts': {
      branches: 50,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'lib/services/fiat.service.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'lib/services/wallet.service.ts': {
      branches: 85,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    'lib/receive-utils.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'lib/services/receive.service.ts': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'app/api/transactions/route.ts': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    'app/api/wallet/balances/route.ts': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    'app/api/wallet/transactions/route.ts': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    'app/api/wallet/send/route.ts': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    'app/api/rates/route.ts': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    'lib/services/asset.service.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'lib/helpers/conversion-math.ts': {
      branches: 90,
      functions: 100,
      lines: 95,
      statements: 95,
    },
    'hooks/useOffRamp.ts': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
}

module.exports = async () => {
  const baseConfig = await createJestConfig(customJestConfig)()
  return {
    ...baseConfig,
    transformIgnorePatterns: [
      '/node_modules/(?!(@stellar/stellar-sdk|@noble|@stellar|uint8array-extras|next-intl|use-intl|@formatjs|intl-messageformat)/)',
    ],
  }
}
