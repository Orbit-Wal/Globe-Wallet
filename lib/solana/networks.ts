import type { SolanaNetworkConfig } from '../types'

/**
 * Solana devnet by default, matching the DoD in Issue #142. USDC mint is
 * Circle's official devnet deployment:
 * https://developers.circle.com/stablecoins/usdc-contract-addresses
 */
export const SOLANA_NETWORK: SolanaNetworkConfig = {
  name: 'Solana Devnet',
  testnet: true,
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  blockExplorerUrl: 'https://explorer.solana.com/?cluster=devnet',
  tokens: {
    USDC: { mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', decimals: 6 },
  },
}

export function getSolanaNetwork(): SolanaNetworkConfig {
  return SOLANA_NETWORK
}
