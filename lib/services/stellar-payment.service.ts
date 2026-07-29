import * as StellarSdk from '@stellar/stellar-sdk'
import { SUPPORTED_STELLAR_ASSETS } from '../fixtures'

/**
 * lib/services/stellar-payment.service.ts
 * Issue #63 — real transaction building, signing, and submission for `sendPayment`.
 *
 * This is the server-only counterpart to TransactionSyncService
 * (lib/services/transaction-sync.service.ts), which already does real,
 * read-only Horizon polling. Where that service *reads* ledger state, this
 * one *writes* it: it builds a Stellar payment transaction, signs it with a
 * configured source secret key, and submits it to Horizon exactly the way
 * `Orbit-Wal/backend`'s StellarService does — same SDK, same operation
 * shape — just embedded directly in this app's own API route instead of
 * proxied to a separate deployable service.
 *
 * Never import this module from client code. It reads a secret key from
 * server-only environment variables and must only ever run inside a Next.js
 * Route Handler (App Router routes are server-only by default).
 */

export interface StellarPaymentConfig {
  horizonUrl: string
  networkPassphrase: string
  sourceSecretKey: string
}

export interface SubmitPaymentParams {
  /** Destination Stellar public key. Caller must have already validated this with StrKey. */
  destination: string
  /** Positive amount, already validated by the caller. */
  amount: number
  /** Asset code — must be present in SUPPORTED_STELLAR_ASSETS (checked here defensively too). */
  asset: string
  /** Optional memo text. Must be <= 28 bytes (Stellar's MEMO_TEXT limit) — enforced here. */
  memo?: string
}

export type PaymentLedgerStatus = 'completed' | 'pending' | 'failed'

export interface SubmitPaymentResult {
  /**
   * Real, deterministic Stellar transaction hash (64 lowercase hex chars),
   * computed from the signed transaction envelope. Present even when the
   * submission fails or times out, so a rejected or ambiguous attempt is
   * still verifiable against Horizon/stellar.expert by hash.
   */
  hash: string
  /** Reflects what Horizon actually told us — never an assumed success. */
  status: PaymentLedgerStatus
  ledger?: number
  error?: string
}

/** Thrown when the server-side signing configuration is missing entirely (not a per-request error). */
export class StellarPaymentConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StellarPaymentConfigError'
  }
}

function resolveNetworkPassphrase(): string {
  const override = process.env.STELLAR_NETWORK_PASSPHRASE
  if (override) return override
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'testnet'
    ? StellarSdk.Networks.TESTNET
    : StellarSdk.Networks.PUBLIC
}

function loadConfig(): StellarPaymentConfig | null {
  const horizonUrl = process.env.STELLAR_HORIZON_URL
  const sourceSecretKey = process.env.STELLAR_SOURCE_SECRET_KEY

  if (!horizonUrl || !sourceSecretKey) return null
  return { horizonUrl, sourceSecretKey, networkPassphrase: resolveNetworkPassphrase() }
}

/** Resolves an asset code to a Stellar SDK Asset using the app's known-issuer fixture list. */
function resolveAsset(assetCode: string): StellarSdk.Asset | null {
  if (assetCode === 'XLM') return StellarSdk.Asset.native()

  const supported = SUPPORTED_STELLAR_ASSETS.find((a) => a.code === assetCode)
  if (!supported || supported.issuer === 'native') return null
  return new StellarSdk.Asset(supported.code, supported.issuer)
}

/** Duck-types the shape callers of this SDK build attach to a rejected request (see note below). */
function getHorizonResponse(err: unknown): { status?: number; data?: any } | undefined {
  return (err as { response?: { status?: number; data?: any } } | undefined)?.response
}

function describeResultCodes(data: any): string | undefined {
  const resultCodes = data?.extras?.result_codes as
    | { transaction?: string; operations?: string[] }
    | undefined
  if (!resultCodes) return data?.detail ?? data?.title
  const opCodes = resultCodes.operations?.length ? `, operations=${resultCodes.operations.join(',')}` : ''
  return `transaction=${resultCodes.transaction ?? 'unknown'}${opCodes}`
}

export class StellarPaymentService {
  private readonly config: StellarPaymentConfig | null
  private readonly server: StellarSdk.Horizon.Server | null

  constructor(config: StellarPaymentConfig | null = loadConfig()) {
    this.config = config
    this.server = config ? new StellarSdk.Horizon.Server(config.horizonUrl) : null
  }

  /** Public key of the configured signer, if any — used by the route to catch account/key mismatches. */
  getSigningPublicKey(): string | null {
    if (!this.config) return null
    return StellarSdk.Keypair.fromSecret(this.config.sourceSecretKey).publicKey()
  }

  private requireReady(): { config: StellarPaymentConfig; server: StellarSdk.Horizon.Server } {
    if (!this.config || !this.server) {
      throw new StellarPaymentConfigError(
        'Live Stellar payment submission is not configured. Set STELLAR_HORIZON_URL and ' +
          'STELLAR_SOURCE_SECRET_KEY (a funded Stellar secret key for the sending account) as ' +
          'server-only environment variables — see .env.example.',
      )
    }
    return { config: this.config, server: this.server }
  }

  /**
   * Builds, signs, and submits a real Stellar payment transaction.
   *
   * Assumes `params` has already passed input validation (address checksum,
   * positive amount, supported asset, memo length) — this method only
   * handles the network-facing part and never throws for ledger-level
   * outcomes; it *only* throws for the config-missing case above, and for
   * a genuinely unsupported asset (defense in depth against a caller bug).
   */
  async submitPayment(params: SubmitPaymentParams): Promise<SubmitPaymentResult> {
    const { config, server } = this.requireReady()

    const asset = resolveAsset(params.asset)
    if (!asset) {
      throw new Error(`Unsupported or unconfigured asset: ${params.asset}`)
    }

    const sourceKeypair = StellarSdk.Keypair.fromSecret(config.sourceSecretKey)

    let account: StellarSdk.Horizon.AccountResponse
    try {
      account = await server.loadAccount(sourceKeypair.publicKey())
    } catch (err) {
      // Nothing was ever built or submitted — this is a definitive failure,
      // not an ambiguous one.
      return { hash: '', status: 'failed', error: this.describeLoadAccountError(err) }
    }

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: params.destination,
          asset,
          amount: params.amount.toFixed(7),
        }),
      )
      .setTimeout(30)

    if (params.memo) {
      txBuilder.addMemo(StellarSdk.Memo.text(params.memo))
    }

    let transaction: StellarSdk.Transaction
    try {
      transaction = txBuilder.build()
      transaction.sign(sourceKeypair)
    } catch (err) {
      return {
        hash: '',
        status: 'failed',
        error: err instanceof Error ? err.message : 'Failed to build transaction',
      }
    }

    // Computed before submission so we always have a real, verifiable hash —
    // even if submission is rejected or the response never arrives.
    const hash = transaction.hash().toString('hex')

    try {
      const response = await server.submitTransaction(transaction)
      return {
        hash: response.hash || hash,
        status: response.successful ? 'completed' : 'failed',
        ledger: response.ledger,
      }
    } catch (err) {
      return this.describeSubmissionOutcome(err, hash)
    }
  }

  private describeLoadAccountError(err: unknown): string {
    const horizonResponse = getHorizonResponse(err)
    if (horizonResponse?.status === 404) {
      return 'Source account does not exist or is not funded on this network'
    }
    return err instanceof Error ? err.message : 'Failed to load source account'
  }

  /**
   * Distinguishes a definitive Horizon rejection from a genuinely ambiguous
   * outcome (no response received at all — timeout, dropped connection,
   * DNS failure). Only the latter is "pending": the envelope was signed and
   * sent, so it may still land in a ledger even though we never saw the
   * reply. TransactionSyncService.syncFromNetwork() already knows how to
   * reconcile a pending hash against Horizon later (see
   * lib/services/transaction-sync.service.ts), so this status is not a dead
   * end — it is resolved by the existing settlement poller.
   */
  private describeSubmissionOutcome(err: unknown, hash: string): SubmitPaymentResult {
    const horizonResponse = getHorizonResponse(err)

    if (horizonResponse && typeof horizonResponse.status === 'number') {
      const detail = describeResultCodes(horizonResponse.data) ?? (err instanceof Error ? err.message : 'rejected')
      return {
        hash,
        status: 'failed',
        error: `Horizon rejected the transaction (HTTP ${horizonResponse.status}): ${detail}`,
      }
    }

    return {
      hash,
      status: 'pending',
      error: err instanceof Error ? err.message : 'No response received from Horizon before the request timed out',
    }
  }
}

// Lazily-constructed singleton so route handlers share one Horizon client
// and re-read environment configuration is not repeated per-request.
let sharedInstance: StellarPaymentService | null = null

export function getStellarPaymentService(): StellarPaymentService {
  if (!sharedInstance) {
    sharedInstance = new StellarPaymentService()
  }
  return sharedInstance
}
