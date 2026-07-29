import { z } from 'zod'

/**
 * Runtime configuration used by server processes. Keep this list in sync with
 * .env.example; `npm run check:env` enforces that contract.
 */
export const environmentVariableNames = [
  'NEXT_PUBLIC_STELLAR_NETWORK',
  'STELLAR_HORIZON_URL',
  'NEXT_PUBLIC_APP_ENV',
  'STELLAR_NETWORK_PASSPHRASE',
  'STELLAR_SOURCE_SECRET_KEY',
  'NEXT_PUBLIC_API_BASE_URL',
  'MERGE_ANALYTICS_URL',
  'SOROBAN_RPC_URL',
  'SOROBAN_CONTRACT_ID_GLOBE_WALLET',
  'SOROBAN_CONTRACT_ID_TOKEN_WRAPPER',
]

const optionalNonEmptyString = (schema) => z.preprocess(
  (value) => value === '' ? undefined : value,
  schema.optional(),
)

export const environmentSchema = z.object({
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(['testnet', 'mainnet']),
  STELLAR_HORIZON_URL: z.string().url(),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).optional(),
  STELLAR_NETWORK_PASSPHRASE: optionalNonEmptyString(z.string().min(1)),
  STELLAR_SOURCE_SECRET_KEY: optionalNonEmptyString(z.string().regex(/^S[A-Z0-9]{55}$/, 'must be a Stellar secret key (starts with S, 56 chars)')),
  NEXT_PUBLIC_API_BASE_URL: optionalNonEmptyString(z.string().url()),
  MERGE_ANALYTICS_URL: optionalNonEmptyString(z.string().url()),
  SOROBAN_RPC_URL: optionalNonEmptyString(z.string().url()),
  SOROBAN_CONTRACT_ID_GLOBE_WALLET: optionalNonEmptyString(z.string().min(1)),
  SOROBAN_CONTRACT_ID_TOKEN_WRAPPER: optionalNonEmptyString(z.string().min(1)),
})

export function validateEnvironment(environment = process.env) {
  const result = environmentSchema.safeParse(environment)

  if (result.success) return result.data

  const details = result.error.issues
    .map(({ path, message }) => `  - ${path.join('.')}: ${message}`)
    .join('\n')

  throw new Error(
    `Invalid environment configuration. Fix the following values before starting Globe Wallet:\n${details}\nSee .env.example for valid values.`,
  )
}
