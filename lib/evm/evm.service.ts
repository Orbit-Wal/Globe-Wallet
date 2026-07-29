import { createPublicClient, http, isAddress, getAddress, formatUnits, erc20Abi, type Chain, type PublicClient } from 'viem'
import { baseSepolia, sepolia } from 'viem/chains'
import {
  IEvmService,
  EvmChainId,
  EvmNetworkConfig,
  EvmBalance,
  EvmServiceError,
} from '../types'
import { formatAddress } from '../helpers/format'
import { EVM_NETWORKS, getEvmNetwork } from './networks'

// Cast to the general `Chain` type when constructing clients: baseSepolia and
// sepolia are distinct literal types (different formatters/serializers), and
// viem's generics don't like a Map holding clients for two different chain
// literals under one type. Only the chain id/rpc actually matter at runtime.
const VIEM_CHAIN: Record<EvmChainId, Chain> = {
  base: baseSepolia,
  ethereum: sepolia,
}

const clients = new Map<EvmChainId, PublicClient>()

function getClient(chainId: EvmChainId): PublicClient {
  let client = clients.get(chainId)
  if (!client) {
    const network = getEvmNetwork(chainId)
    client = createPublicClient({
      chain: VIEM_CHAIN[chainId],
      transport: http(network.rpcUrl),
    })
    clients.set(chainId, client)
  }
  return client
}

/**
 * Read-only balance queries against real testnet RPCs (Base Sepolia /
 * Ethereum Sepolia) — no secret key required. Signing/submission lives in
 * evm-payment.service.ts, which is server-only.
 */
export class EvmService implements IEvmService {
  getSupportedChains(): EvmNetworkConfig[] {
    return Object.values(EVM_NETWORKS)
  }

  getNetwork(chainId: EvmChainId): EvmNetworkConfig {
    return getEvmNetwork(chainId)
  }

  validateAddress(address: string): boolean {
    return isAddress(address)
  }

  async getBalances(chainId: EvmChainId, address: string): Promise<EvmBalance[]> {
    if (!this.validateAddress(address)) {
      throw new EvmServiceError(`Not a valid EVM address: ${address}`, 'ERR_INVALID_ADDRESS')
    }

    const network = getEvmNetwork(chainId)
    const checksummed = getAddress(address)
    const client = getClient(chainId)

    try {
      const [nativeRaw, ...tokenResults] = await Promise.all([
        client.getBalance({ address: checksummed }),
        ...Object.entries(network.tokens).map(([, token]) =>
          client.readContract({
            address: token!.address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [checksummed],
          }),
        ),
      ])

      const balances: EvmBalance[] = [
        {
          symbol: network.nativeCurrency.symbol,
          amount: Number(formatUnits(nativeRaw, network.nativeCurrency.decimals)),
          raw: nativeRaw.toString(),
          decimals: network.nativeCurrency.decimals,
        },
      ]

      Object.entries(network.tokens).forEach(([symbol, token], index) => {
        const raw = tokenResults[index] as bigint
        balances.push({
          symbol: symbol as EvmBalance['symbol'],
          amount: Number(formatUnits(raw, token!.decimals)),
          raw: raw.toString(),
          decimals: token!.decimals,
        })
      })

      return balances
    } catch (err) {
      throw new EvmServiceError(
        err instanceof Error ? `Failed to fetch ${network.name} balances: ${err.message}` : 'Failed to fetch balances',
        'ERR_NETWORK_FAILURE',
      )
    }
  }

  shortenKey(key: string, lead = 6, tail = 4): string {
    return formatAddress(key, lead, tail)
  }
}

export const evmService = new EvmService()
