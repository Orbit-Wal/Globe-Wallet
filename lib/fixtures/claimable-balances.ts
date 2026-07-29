import { ClaimableBalance } from '../types'
import { TEST_STELLAR_ADDRESS } from './stellar'

/**
 * Mock claimable balances for testing (Issue #99)
 * These simulate claimable balances that might be distributed
 * via airdrops, refunds, or conditional payments on the Stellar network.
 */
export const MOCK_CLAIMABLE_BALANCES: ClaimableBalance[] = [
  {
    id: 'cb-1',
    balanceId: '0x0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b',
    asset: 'USDC',
    amount: 100.5,
    claimants: [
      {
        destination: TEST_STELLAR_ADDRESS,
      },
    ],
    sponsor: 'GBJQYZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZ',
    status: 'available',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    memo: 'Airdrop reward',
    memoType: 'text',
  },
  {
    id: 'cb-2',
    balanceId: '0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
    asset: 'XLM',
    amount: 500,
    claimants: [
      {
        destination: TEST_STELLAR_ADDRESS,
      },
    ],
    sponsor: 'GBJQYZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZ',
    status: 'available',
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    memo: 'Loyalty bonus',
    memoType: 'text',
  },
  {
    id: 'cb-3',
    balanceId: '0x2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d',
    asset: 'USDT',
    amount: 250,
    claimants: [
      {
        destination: TEST_STELLAR_ADDRESS,
      },
    ],
    sponsor: 'GBJQYZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZJZ',
    status: 'available',
    createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
    memo: 'Referral bonus',
    memoType: 'text',
  },
]

/**
 * Total amount of all claimable balances (for quick UI summaries)
 */
export const TOTAL_CLAIMABLE_AMOUNT = MOCK_CLAIMABLE_BALANCES.reduce(
  (sum, b) => sum + b.amount,
  0
)

/**
 * Asset breakdown of claimable balances
 */
export const CLAIMABLE_BALANCES_BY_ASSET: Record<string, number> = {
  XLM: 500,
  USDC: 100.5,
  USDT: 250,
}
