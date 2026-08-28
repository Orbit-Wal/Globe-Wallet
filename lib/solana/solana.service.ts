import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  ISolanaService,
  SolanaNetworkConfig,
  SolanaBalance,
  SolanaServiceError,
} from '../types'
import { formatAddress } from '../helpers/format'
import { getSolanaNetwork } from './networks'

let sharedConnection: Connection | null = null

function getConnection(): Connection {
  if (!sharedConnection) {
    sharedConnection = new Connection(getSolanaNetwork().rpcUrl, 'confirmed')
  }
  return sharedConnection
}

/**
 * Read-only balance queries against real Solana devnet RPC — no secret key
 * required. Signing/submission lives in solana-payment.service.ts, which is
 * server-only. Mirrors lib/evm/evm.service.ts's shape.
 */
export class SolanaService implements ISolanaService {
  getNetwork(): SolanaNetworkConfig {
    return getSolanaNetwork()
  }

  validateAddress(address: string): boolean {
    try {
      // PublicKey validates base58 + that it decodes to exactly 32 bytes.
      new PublicKey(address)
      return true
    } catch {
      return false
    }
  }

  async getBalances(address: string): Promise<SolanaBalance[]> {
    if (!this.validateAddress(address)) {
      throw new SolanaServiceError(`Not a valid Solana address: ${address}`, 'ERR_INVALID_ADDRESS')
    }

    const network = getSolanaNetwork()
    const connection = getConnection()
    const pubkey = new PublicKey(address)

    try {
      const lamports = await connection.getBalance(pubkey)

      const balances: SolanaBalance[] = [
        {
          symbol: 'SOL',
          amount: lamports / LAMPORTS_PER_SOL,
          raw: lamports.toString(),
          decimals: 9,
        },
      ]

      for (const [symbol, token] of Object.entries(network.tokens)) {
        if (!token) continue
        try {
          // No @solana/spl-token dependency needed: getParsedTokenAccountsByOwner
          // filtered by mint returns the owner's associated token account(s)
          // directly via the SPL Token program's parsed account layout.
          const { value } = await connection.getParsedTokenAccountsByOwner(pubkey, {
            mint: new PublicKey(token.mint),
          })
          const raw = value[0]?.account.data.parsed?.info?.tokenAmount?.amount ?? '0'
          balances.push({
            symbol: symbol as SolanaBalance['symbol'],
            amount: Number(raw) / 10 ** token.decimals,
            raw,
            decimals: token.decimals,
          })
        } catch {
          // No associated token account yet — treat as a zero balance rather
          // than failing the whole lookup.
          balances.push({ symbol: symbol as SolanaBalance['symbol'], amount: 0, raw: '0', decimals: token.decimals })
        }
      }

      return balances
    } catch (err) {
      throw new SolanaServiceError(
        err instanceof Error ? `Failed to fetch ${network.name} balances: ${err.message}` : 'Failed to fetch balances',
        'ERR_NETWORK_FAILURE',
      )
    }
  }

  shortenKey(key: string, lead = 4, tail = 4): string {
    return formatAddress(key, lead, tail)
  }
}

export const solanaService = new SolanaService()

// Re-exported for tests / advanced callers that need the raw connection.
export { getConnection as getSolanaConnection }
