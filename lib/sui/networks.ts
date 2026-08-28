import type { SuiNetworkConfig } from '../types'

/**
 * Sui testnet by default, matching the DoD in Issue #143. USDC coin type is
 * Circle's official testnet deployment:
 * https://developers.circle.com/stablecoins/usdc-contract-addresses
 */
export const SUI_NETWORK: SuiNetworkConfig = {
  name: 'Sui Testnet',
  testnet: true,
  rpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
  blockExplorerUrl: 'https://suiscan.xyz/testnet',
  tokens: {
    USDC: {
      coinType: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e8::usdc::USDC',
      decimals: 6,
    },
  },
}

export function getSuiNetwork(): SuiNetworkConfig {
  return SUI_NETWORK
}
