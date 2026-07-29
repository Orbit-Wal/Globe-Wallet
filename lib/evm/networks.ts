import type { EvmChainId, EvmNetworkConfig } from '../types'

/**
 * Testnet by default, matching the rest of the app (NEXT_PUBLIC_STELLAR_NETWORK
 * defaults to testnet too). USDC addresses are Circle's official testnet
 * deployments: https://developers.circle.com/stablecoins/usdc-contract-addresses
 */
export const EVM_NETWORKS: Record<EvmChainId, EvmNetworkConfig> = {
  base: {
    chainId: 'base',
    id: 84532,
    name: 'Base Sepolia',
    testnet: true,
    rpcUrl: process.env.BASE_RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
    blockExplorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    tokens: {
      USDC: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6 },
    },
  },
  ethereum: {
    chainId: 'ethereum',
    id: 11155111,
    name: 'Ethereum Sepolia',
    testnet: true,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    blockExplorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    tokens: {
      USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
    },
  },
}

export function getEvmNetwork(chainId: EvmChainId): EvmNetworkConfig {
  const network = EVM_NETWORKS[chainId]
  if (!network) {
    throw new Error(`Unsupported EVM chain: ${chainId}`)
  }
  return network
}
