import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import bs58 from 'bs58'
import type { SolanaTransactionStatus } from '../types'
import { solanaService } from './solana.service'
import { getSolanaNetwork } from './networks'

/**
 * lib/solana/solana-payment.service.ts
 * Server-only counterpart to solana.service.ts (which is read-only). Mirrors
 * lib/evm/evm-payment.service.ts / lib/services/stellar-payment.service.ts:
 * build, sign, and broadcast a real native SOL transfer with a
 * server-configured account, gated behind SOLANA_SOURCE_PRIVATE_KEY.
 *
 * MVP scope is native SOL transfers only — SPL-token (USDC) sends are
 * tracked as follow-up work, same as ERC-20 sends in the EVM module.
 *
 * Never import this module from client code. It reads a secret key from
 * server-only environment variables and must only ever run inside a Next.js
 * Route Handler.
 */

export interface SubmitSolanaPaymentParams {
  /** Caller must have already validated this with solanaService.validateAddress. */
  destination: string
  /** Positive SOL amount, already validated by the caller. */
  amount: number
}

export interface SubmitSolanaPaymentResult {
  signature?: string
  status: SolanaTransactionStatus
  error?: string
}

export class SolanaPaymentConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SolanaPaymentConfigError'
  }
}

function loadKeypair(): Keypair | null {
  const key = process.env.SOLANA_SOURCE_PRIVATE_KEY
  if (!key) return null
  try {
    // Accept either a base58-encoded secret key (Phantom/CLI export format)
    // or a JSON array of bytes (solana-keygen format).
    const bytes = key.trim().startsWith('[') ? Uint8Array.from(JSON.parse(key)) : bs58.decode(key)
    return Keypair.fromSecretKey(bytes)
  } catch {
    return null
  }
}

export class SolanaPaymentService {
  private readonly keypair: Keypair | null
  private readonly connection: Connection

  constructor(keypair: Keypair | null = loadKeypair()) {
    this.keypair = keypair
    this.connection = new Connection(getSolanaNetwork().rpcUrl, 'confirmed')
  }

  /** Address of the configured signer, if any — used by the route to catch account/key mismatches. */
  getSigningAddress(): string | null {
    return this.keypair?.publicKey.toBase58() ?? null
  }

  private requireKeypair(): Keypair {
    if (!this.keypair) {
      throw new SolanaPaymentConfigError(
        'Live Solana payment submission is not configured. Set SOLANA_SOURCE_PRIVATE_KEY (a funded ' +
          'devnet account\'s base58 secret key) as a server-only environment variable — see .env.example.',
      )
    }
    return this.keypair
  }

  /**
   * Builds, signs, and broadcasts a real native SOL transfer.
   * Assumes `params` has already passed input validation (address shape,
   * positive amount) — only throws for the config-missing case; every
   * ledger-level outcome is returned, never thrown.
   */
  async submitPayment(params: SubmitSolanaPaymentParams): Promise<SubmitSolanaPaymentResult> {
    const keypair = this.requireKeypair()

    if (!solanaService.validateAddress(params.destination)) {
      return { status: 'failed', error: 'Not a valid Solana address' }
    }

    try {
      const lamports = Math.round(params.amount * 1_000_000_000)
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(params.destination),
          lamports,
        }),
      )

      const signature = await sendAndConfirmTransaction(this.connection, transaction, [keypair], {
        commitment: 'confirmed',
      })

      return { signature, status: 'completed' }
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Failed to broadcast transaction',
      }
    }
  }
}

let sharedInstance: SolanaPaymentService | null = null

export function getSolanaPaymentService(): SolanaPaymentService {
  if (!sharedInstance) {
    sharedInstance = new SolanaPaymentService()
  }
  return sharedInstance
}
