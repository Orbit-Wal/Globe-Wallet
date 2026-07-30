import { createWalletClient, http, parseEther, type Chain, type Hex, type WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, sepolia } from 'viem/chains'
import type { EvmChainId } from '../types'
import { getEvmNetwork } from './networks'
import { evmService } from './evm.service'

/**
 * lib/evm/evm-payment.service.ts
 * Server-only counterpart to evm.service.ts (which is read-only). Mirrors
 * lib/services/stellar-payment.service.ts: build, sign, and broadcast a real
 * native-currency transaction with a server-configured account, gated behind
 * EVM_SOURCE_PRIVATE_KEY.
 *
 * MVP scope is native-currency transfers only (ETH on Base/Ethereum
 * testnets) — ERC-20 sends are tracked as follow-up work, not half-wired
 * here.
 *
 * Never import this module from client code. It reads a secret key from
 * server-only environment variables and must only ever run inside a Next.js
 * Route Handler.
 */

const VIEM_CHAIN: Record<EvmChainId, Chain> = { base: baseSepolia, ethereum: sepolia }

export interface SubmitEvmPaymentParams {
  chainId: EvmChainId
  /** Caller must have already validated this with evmService.validateAddress. */
  destination: string
  /** Positive ETH amount, already validated by the caller. */
  amount: number
}

export type EvmPaymentStatus = 'completed' | 'pending' | 'failed'

export interface SubmitEvmPaymentResult {
  hash?: Hex
  status: EvmPaymentStatus
  error?: string
}

export class EvmPaymentConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EvmPaymentConfigError'
  }
}

function loadPrivateKey(): Hex | null {
  const key = process.env.EVM_SOURCE_PRIVATE_KEY
  if (!key) return null
  return key as Hex
}

export class EvmPaymentService {
  private readonly privateKey: Hex | null

  constructor(privateKey: Hex | null = loadPrivateKey()) {
    this.privateKey = privateKey
  }

  /** Address of the configured signer, if any — used by the route to catch account/key mismatches. */
  getSigningAddress(): string | null {
    if (!this.privateKey) return null
    return privateKeyToAccount(this.privateKey).address
  }

  private requireClient(chainId: EvmChainId): WalletClient {
    if (!this.privateKey) {
      throw new EvmPaymentConfigError(
        'Live EVM payment submission is not configured. Set EVM_SOURCE_PRIVATE_KEY (a funded ' +
          'testnet account\'s private key) as a server-only environment variable — see .env.example.',
      )
    }
    const account = privateKeyToAccount(this.privateKey)
    const network = getEvmNetwork(chainId)
    return createWalletClient({
      account,
      chain: VIEM_CHAIN[chainId],
      transport: http(network.rpcUrl),
    })
  }

  /**
   * Builds, signs, and broadcasts a real native-currency transfer.
   * Assumes `params` has already passed input validation (address checksum,
   * positive amount) — only throws for the config-missing case; every
   * ledger-level outcome is returned, never thrown.
   */
  async submitPayment(params: SubmitEvmPaymentParams): Promise<SubmitEvmPaymentResult> {
    const client = this.requireClient(params.chainId)
    const network = getEvmNetwork(params.chainId)

    if (!evmService.validateAddress(params.destination)) {
      return { status: 'failed', error: `Not a valid ${network.name} address` }
    }

    let hash: Hex
    try {
      hash = await client.sendTransaction({
        account: client.account!,
        to: params.destination as Hex,
        value: parseEther(params.amount.toString()),
        chain: VIEM_CHAIN[params.chainId],
      })
    } catch (err) {
      return { status: 'failed', error: err instanceof Error ? err.message : 'Failed to broadcast transaction' }
    }

    // The transaction is broadcast at this point regardless of what happens
    // next — a hash always comes back. Waiting for the receipt just tells us
    // whether to report it as confirmed or leave it "pending" for the
    // existing settlement/poll path to catch up on later.
    try {
      const publicClient = await import('viem').then(({ createPublicClient }) =>
        createPublicClient({ chain: VIEM_CHAIN[params.chainId], transport: http(network.rpcUrl) }),
      )
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 20_000 })
      return { hash, status: receipt.status === 'success' ? 'completed' : 'failed' }
    } catch (err) {
      return {
        hash,
        status: 'pending',
        error: err instanceof Error ? err.message : 'No confirmation received before the request timed out',
      }
    }
  }
}

let sharedInstance: EvmPaymentService | null = null

export function getEvmPaymentService(): EvmPaymentService {
  if (!sharedInstance) {
    sharedInstance = new EvmPaymentService()
  }
  return sharedInstance
}
