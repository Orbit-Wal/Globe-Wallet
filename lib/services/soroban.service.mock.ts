import { BaseService } from './base.service'
import { ISorobanService, SorobanAssetInfo, TransactionResult } from '../types'

/**
 * Mock Soroban service for development and testing.
 * Simulates GlobeWallet contract calls without network interaction.
 */
export class SorobanMockService extends BaseService implements ISorobanService {
  constructor() {
    super('SorobanMockService')
  }

  async addAsset(_user: string, _asset: SorobanAssetInfo): Promise<TransactionResult> {
    return this.withPerformanceTracking('addAsset', async () => {
      try {
        console.log(`[mock] Invoking GlobeWallet::add_asset for ${_asset.code}`)
        await new Promise(r => setTimeout(r, 800))
        return { success: true, hash: 'mock_soroban_' + Math.random().toString(16).slice(2) }
      } catch (err) {
        this.handleError(err, 'addAsset')
      }
    })
  }

  async removeAsset(_user: string, _asset: SorobanAssetInfo): Promise<TransactionResult> {
    return this.withPerformanceTracking('removeAsset', async () => {
      try {
        console.log(`[mock] Invoking GlobeWallet::remove_asset for ${_asset.code}`)
        await new Promise(r => setTimeout(r, 800))
        return { success: true, hash: 'mock_soroban_' + Math.random().toString(16).slice(2) }
      } catch (err) {
        this.handleError(err, 'removeAsset')
      }
    })
  }

  async getAssets(_user: string): Promise<SorobanAssetInfo[]> {
    return this.withPerformanceTracking('getAssets', async () => {
      try {
        console.log(`[mock] Invoking GlobeWallet::get_assets`)
        await new Promise(r => setTimeout(r, 500))
        return [
          { code: 'XLM' },
          { code: 'USDC', issuer: 'GA5ZSEJYB37JDD5GUPFY7WIFCITB4JY5JH5GFY2MNZ5GT7YSN5HDKHJ' },
        ]
      } catch (err) {
        this.handleError(err, 'getAssets')
      }
    })
  }

  async setSpendLimit(_user: string, _asset: SorobanAssetInfo, _limit: bigint): Promise<TransactionResult> {
    return this.withPerformanceTracking('setSpendLimit', async () => {
      try {
        console.log(`[mock] Invoking GlobeWallet::set_spend_limit for ${_asset.code}`)
        await new Promise(r => setTimeout(r, 800))
        return { success: true, hash: 'mock_soroban_' + Math.random().toString(16).slice(2) }
      } catch (err) {
        this.handleError(err, 'setSpendLimit')
      }
    })
  }

  async getSpendLimit(_user: string, _asset: SorobanAssetInfo): Promise<bigint> {
    return this.withPerformanceTracking('getSpendLimit', async () => {
      try {
        console.log(`[mock] Invoking GlobeWallet::get_spend_limit for ${_asset.code}`)
        await new Promise(r => setTimeout(r, 500))
        return BigInt(1_000_000_000)
      } catch (err) {
        this.handleError(err, 'getSpendLimit')
      }
    })
  }

  async recordSpend(_user: string, _asset: SorobanAssetInfo, _amount: bigint): Promise<TransactionResult> {
    return this.withPerformanceTracking('recordSpend', async () => {
      try {
        console.log(`[mock] Invoking GlobeWallet::record_spend for ${_asset.code}`)
        await new Promise(r => setTimeout(r, 800))
        return { success: true, hash: 'mock_soroban_' + Math.random().toString(16).slice(2) }
      } catch (err) {
        this.handleError(err, 'recordSpend')
      }
    })
  }
}
