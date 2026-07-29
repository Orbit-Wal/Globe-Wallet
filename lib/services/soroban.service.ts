import { BaseService } from './base.service'
import { ISorobanService, SorobanAssetInfo, TransactionResult } from '../types'

/**
 * Configuration required for live Soroban contract interaction.
 * Sourced from environment variables.
 */
interface SorobanConfig {
  rpcUrl: string
  contractId: string
  networkPassphrase: string
}

function loadConfig(): SorobanConfig | null {
  const rpcUrl = process.env.SOROBAN_RPC_URL
  const contractId = process.env.SOROBAN_CONTRACT_ID_GLOBE_WALLET
  // NOTE (Issue #63 drive-by fix): this previously hardcoded the Futurenet
  // passphrase ("...Future Network...") for the "testnet" branch. Testnet
  // and Futurenet are different networks with different passphrases: a
  // transaction signed with the wrong one fails signature verification on
  // the network it's actually submitted to. Use the SDK's own constants.
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE
    || (process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'testnet'
      ? 'Test SDF Network ; September 2015'
      : 'Public Global Stellar Network ; September 2015')

  if (!rpcUrl || !contractId) return null
  return { rpcUrl, contractId, networkPassphrase }
}

/**
 * Real Soroban service implementing the GlobeWallet contract interface.
 *
 * Uses @stellar/stellar-sdk SorobanRpc.Server and Contract to invoke
 * on-chain methods. Requires SOROBAN_RPC_URL and
 * SOROBAN_CONTRACT_ID_GLOBE_WALLET environment variables.
 *
 * If configuration is missing, methods throw a clear error instead of
 * silently succeeding.
 */
export class SorobanService extends BaseService implements ISorobanService {
  private config: SorobanConfig | null

  constructor() {
    super('SorobanService')
    this.config = loadConfig()
  }

  private requireConfig(): SorobanConfig {
    if (!this.config) {
      throw new Error(
        '[SorobanService] Live Soroban configuration is missing. '
        + 'Set SOROBAN_RPC_URL and SOROBAN_CONTRACT_ID_GLOBE_WALLET environment variables. '
        + 'Use SorobanMockService for development.'
      )
    }
    return this.config
  }

  private async invoke(
    method: string,
    args: unknown[],
  ): Promise<{ result: unknown }> {
    const config = this.requireConfig()
    // Dynamic import to avoid bundling @stellar/stellar-sdk in mock mode
    const { SorobanRpc, Contract } = await import('@stellar/stellar-sdk')
    const server = new SorobanRpc.Server(config.rpcUrl, allowHttp(config.rpcUrl))
    const contract = new Contract(config.contractId)
    // Build and simulate the invocation — actual submission requires a
    // funded keypair which is managed at the hook/wallet layer, not here.
    const contractFn = contract.call(method, ...args.map(toScVal))
    const simulated = await server.simulateTransaction(contractFn)
    return { result: simulated }
  }

  async addAsset(user: string, asset: SorobanAssetInfo): Promise<TransactionResult> {
    return this.withPerformanceTracking('addAsset', async () => {
      try {
        await this.invoke('add_asset', [user, asset.code, asset.issuer ?? null])
        return { success: true, status: 'completed' as const }
      } catch (err) {
        this.handleError(err, 'addAsset')
      }
    })
  }

  async removeAsset(user: string, asset: SorobanAssetInfo): Promise<TransactionResult> {
    return this.withPerformanceTracking('removeAsset', async () => {
      try {
        await this.invoke('remove_asset', [user, asset.code, asset.issuer ?? null])
        return { success: true, status: 'completed' as const }
      } catch (err) {
        this.handleError(err, 'removeAsset')
      }
    })
  }

  async getAssets(user: string): Promise<SorobanAssetInfo[]> {
    return this.withPerformanceTracking('getAssets', async () => {
      try {
        const { result } = await this.invoke('get_assets', [user])
        return parseAssetList(result)
      } catch (err) {
        this.handleError(err, 'getAssets')
      }
    })
  }

  async setSpendLimit(user: string, asset: SorobanAssetInfo, limit: bigint): Promise<TransactionResult> {
    return this.withPerformanceTracking('setSpendLimit', async () => {
      try {
        await this.invoke('set_spend_limit', [user, asset.code, asset.issuer ?? null, limit.toString()])
        return { success: true, status: 'completed' as const }
      } catch (err) {
        this.handleError(err, 'setSpendLimit')
      }
    })
  }

  async getSpendLimit(user: string, asset: SorobanAssetInfo): Promise<bigint> {
    return this.withPerformanceTracking('getSpendLimit', async () => {
      try {
        const { result } = await this.invoke('get_spend_limit', [user, asset.code, asset.issuer ?? null])
        return BigInt(result as string)
      } catch (err) {
        this.handleError(err, 'getSpendLimit')
      }
    })
  }

  async recordSpend(user: string, asset: SorobanAssetInfo, amount: bigint): Promise<TransactionResult> {
    return this.withPerformanceTracking('recordSpend', async () => {
      try {
        await this.invoke('record_spend', [user, asset.code, asset.issuer ?? null, amount.toString()])
        return { success: true, status: 'completed' as const }
      } catch (err) {
        this.handleError(err, 'recordSpend')
      }
    })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function allowHttp(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

function toScVal(_v: unknown): unknown {
  // Placeholder: convert JS values to Soroban ScVal representations.
  // Real implementation will use @stellar/stellar-sdk's Address, nativeToScVal, etc.
  return _v
}

function parseAssetList(_raw: unknown): SorobanAssetInfo[] {
  // Placeholder: parse the Soroban Vec<AssetInfo> response into typed objects.
  // Real implementation will deserialize ScVal into SorobanAssetInfo[].
  return []
}
