import { SuiClient } from '@mysten/sui/client'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction as SuiTransaction } from '@mysten/sui/transactions'
import type { SuiTransactionStatus } from '../types'
import { suiService } from './sui.service'
import { getSuiNetwork } from './networks'

/**
 * lib/sui/sui-payment.service.ts
 * Server-only counterpart to sui.service.ts (which is read-only). Mirrors
 * lib/evm/evm-payment.service.ts / lib/solana/solana-payment.service.ts:
 * build, sign, and broadcast a real native SUI transfer with a
 * server-configured account, gated behind SUI_SOURCE_PRIVATE_KEY.
 *
 * MVP scope is native SUI transfers only — coin-type (USDC) sends are
 * tracked as follow-up work, same as ERC-20/SPL-token sends in the other
 * chain modules.
 *
 * Never import this module from client code. It reads a secret key from
 * server-only environment variables and must only ever run inside a Next.js
 * Route Handler.
 */

export interface SubmitSuiPaymentParams {
  /** Caller must have already validated this with suiService.validateAddress. */
  destination: string
  /** Positive SUI amount, already validated by the caller. */
  amount: number
}

export interface SubmitSuiPaymentResult {
  digest?: string
  status: SuiTransactionStatus
  error?: string
}

export class SuiPaymentConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SuiPaymentConfigError'
  }
}

function loadKeypair(): Ed25519Keypair | null {
  const key = process.env.SUI_SOURCE_PRIVATE_KEY
  if (!key) return null
  try {
    // Accepts Sui's standard bech32 "suiprivkey1..." exported-key format.
    return Ed25519Keypair.fromSecretKey(key.trim())
  } catch {
    return null
  }
}

export class SuiPaymentService {
  private readonly keypair: Ed25519Keypair | null
  private readonly client: SuiClient

  constructor(keypair: Ed25519Keypair | null = loadKeypair()) {
    this.keypair = keypair
    this.client = new SuiClient({ url: getSuiNetwork().rpcUrl })
  }

  /** Address of the configured signer, if any — used by the route to catch account/key mismatches. */
  getSigningAddress(): string | null {
    return this.keypair?.toSuiAddress() ?? null
  }

  private requireKeypair(): Ed25519Keypair {
    if (!this.keypair) {
      throw new SuiPaymentConfigError(
        'Live Sui payment submission is not configured. Set SUI_SOURCE_PRIVATE_KEY (a funded ' +
          'testnet account\'s bech32 "suiprivkey1..." secret key) as a server-only environment ' +
          'variable — see .env.example.',
      )
    }
    return this.keypair
  }

  /**
   * Builds, signs, and broadcasts a real native SUI transfer.
   * Assumes `params` has already passed input validation (address shape,
   * positive amount) — only throws for the config-missing case; every
   * ledger-level outcome is returned, never thrown.
   */
  async submitPayment(params: SubmitSuiPaymentParams): Promise<SubmitSuiPaymentResult> {
    const keypair = this.requireKeypair()

    if (!suiService.validateAddress(params.destination)) {
      return { status: 'failed', error: 'Not a valid Sui address' }
    }

    try {
      const mist = BigInt(Math.round(params.amount * 1_000_000_000))
      const tx = new SuiTransaction()
      const [coin] = tx.splitCoins(tx.gas, [mist])
      tx.transferObjects([coin], params.destination)
      tx.setSender(keypair.toSuiAddress())

      const result = await this.client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showEffects: true },
      })

      await this.client.waitForTransaction({ digest: result.digest }).catch(() => null)

      const success = result.effects?.status?.status === 'success'
      return { digest: result.digest, status: success ? 'completed' : 'failed', error: result.effects?.status?.error }
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Failed to broadcast transaction',
      }
    }
  }
}

let sharedInstance: SuiPaymentService | null = null

export function getSuiPaymentService(): SuiPaymentService {
  if (!sharedInstance) {
    sharedInstance = new SuiPaymentService()
  }
  return sharedInstance
}
