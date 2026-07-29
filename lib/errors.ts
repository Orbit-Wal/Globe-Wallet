export const ErrorCodes = {
  ERR_INVALID_ADDRESS: 'ERR_INVALID_ADDRESS',
  ERR_INVALID_AMOUNT: 'ERR_INVALID_AMOUNT',
  ERR_MISSING_ASSET: 'ERR_MISSING_ASSET',
  ERR_UNSUPPORTED_ASSET: 'ERR_UNSUPPORTED_ASSET',
  ERR_MEMO_TOO_LONG: 'ERR_MEMO_TOO_LONG',
  ERR_MISSING_QUERY: 'ERR_MISSING_QUERY',
  ERR_NOT_FEDERATED: 'ERR_NOT_FEDERATED',
  ERR_NOT_FOUND: 'ERR_NOT_FOUND',
  ERR_LOOKUP_FAILED: 'ERR_LOOKUP_FAILED',
  /** The active wallet account's public key doesn't match the configured signing key. */
  ERR_ACCOUNT_KEY_MISMATCH: 'ERR_ACCOUNT_KEY_MISMATCH',
  /** Server is missing the environment configuration needed to sign/submit real transactions. */
  ERR_PAYMENT_NOT_CONFIGURED: 'ERR_PAYMENT_NOT_CONFIGURED',
  ERR_NO_PATH_FOUND: 'ERR_NO_PATH_FOUND',
  ERR_SLIPPAGE_EXCEEDED: 'ERR_SLIPPAGE_EXCEEDED',
  ERR_STALE_QUOTE: 'ERR_STALE_QUOTE',
  ERR_NETWORK_FAILURE: 'ERR_NETWORK_FAILURE',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export function apiError(code: ErrorCode, message: string) {
  return { error: `${code}: ${message}` }
}
