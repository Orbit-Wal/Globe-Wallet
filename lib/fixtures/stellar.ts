import type { StellarAccount } from '../types'

export const TEST_STELLAR_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

/**
 * Second mock Stellar public key used for multi-account / switcher flows.
 *
 * Issue #71: this used to be 'GBBBB...WHF', which is 56 chars and starts
 * with 'G' but fails StrKey's version-byte/CRC16 checksum — it only ever
 * passed because validateAddress() used to be a bare regex. Now that
 * validateAddress() does a real StrKey.isValidEd25519PublicKey() check,
 * fixtures need to be real, checksum-valid addresses too.
 */
export const SECONDARY_STELLAR_ADDRESS = 'GC53XO53XO53XO53XO53XO53XO53XO53XO53XO53XO53XO53XO53XUGE'

export const MOCK_STELLAR_ACCOUNT: StellarAccount = {
  publicKey: TEST_STELLAR_ADDRESS,
  name: 'Primary Wallet',
  network: 'Stellar Public Network',
  isFunded: true,
}

export const MOCK_SECONDARY_STELLAR_ACCOUNT: StellarAccount = {
  publicKey: SECONDARY_STELLAR_ADDRESS,
  name: 'Savings Wallet',
  network: 'Stellar Public Network',
  isFunded: true,
}

export const MOCK_MEMO = 'STLP-2048'
