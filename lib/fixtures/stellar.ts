import type { StellarAccount } from '../types'

export const TEST_STELLAR_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

/** Second mock Stellar public key used for multi-account / switcher flows */
export const SECONDARY_STELLAR_ADDRESS = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF'

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
