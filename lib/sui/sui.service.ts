import { SuiClient } from '@mysten/sui/client'
import { isValidSuiAddress } from '@mysten/sui/utils'
import {
  ISuiService,
  SuiNetworkConfig,
  SuiBalance,
  SuiServiceError,
} from '../types'
import { formatAddress } from '../helpers/format'
import { getSuiNetwork } from './networks'

let sharedClient: SuiClient | null = null

function getClient(): SuiClient {
  if (!sharedClient) {
    sharedClient = new SuiClient({ url: getSuiNetwork().rpcUrl })
  }
  return sharedClient
}

/**
 * Read-only balance queries against real Sui testnet RPC — no secret key
 * required. Signing/submission lives in sui-payment.service.ts, which is
 * server-only. Mirrors lib/evm/evm.service.ts's shape, adapted for Sui's
 * object-centric coin model (getBalance sums owned Coin<T> objects rather
 * than reading a single account balance slot).
 */
export class SuiService implements ISuiService {
  getNetwork(): SuiNetworkConfig {
    return getSuiNetwork()
  }

  validateAddress(address: string): boolean {
    return isValidSuiAddress(address)
  }

  async getBalances(address: string): Promise<SuiBalance[]> {
    if (!this.validateAddress(address)) {
      throw new SuiServiceError(`Not a valid Sui address: ${address}`, 'ERR_INVALID_ADDRESS')
    }

    const network = getSuiNetwork()
    const client = getClient()

    try {
      const native = await client.getBalance({ owner: address })
      const balances: SuiBalance[] = [
        {
          symbol: 'SUI',
          amount: Number(native.totalBalance) / 1e9,
          raw: native.totalBalance,
          decimals: 9,
        },
      ]

      for (const [symbol, token] of Object.entries(network.tokens)) {
        if (!token) continue
        const coin = await client.getBalance({ owner: address, coinType: token.coinType })
        balances.push({
          symbol: symbol as SuiBalance['symbol'],
          amount: Number(coin.totalBalance) / 10 ** token.decimals,
          raw: coin.totalBalance,
          decimals: token.decimals,
        })
      }

      return balances
    } catch (err) {
      throw new SuiServiceError(
        err instanceof Error ? `Failed to fetch ${network.name} balances: ${err.message}` : 'Failed to fetch balances',
        'ERR_NETWORK_FAILURE',
      )
    }
  }

  shortenKey(key: string, lead = 6, tail = 4): string {
    return formatAddress(key, lead, tail)
  }
}

export const suiService = new SuiService()

export { getClient as getSuiClient }
