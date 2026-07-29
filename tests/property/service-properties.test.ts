import fc from 'fast-check'
import { WalletService } from '../../lib/services/wallet.service'
import { PricingService } from '../../lib/services/pricing.service'
import { AssetService } from '../../lib/services/asset.service'
import { FiatService } from '../../lib/services/fiat.service'
import { AssetCode, CurrencyCode } from '../../lib/types'
import { TEST_STELLAR_ADDRESS } from '../../lib/fixtures'

describe('Service Interface Compliance Properties', () => {
  const walletService = new WalletService()
  const pricingService = new PricingService()
  const assetService = new AssetService()
  const fiatService = new FiatService()

  it('Property 1: PricingService should handle all operations correctly', () => {
    fc.assert(fc.property(
      fc.constantFrom('XLM', 'USDC', 'USDT'),
      fc.double({ min: 0.01, max: 10000, noNaN: true }),
      (assetCode, amount) => {
        const assets = pricingService.getAssets()
        expect(Array.isArray(assets)).toBe(true)
        expect(assets.length).toBeGreaterThan(0)

        // Test formatting
        const formatted = assetService.formatAsset(amount, assetCode as AssetCode)
        expect(typeof formatted).toBe('string')
        expect(formatted).toContain(assetCode)

        // Test conversion
        if (assetCode === 'XLM') {
          const converted = assetService.convertAsset(assetCode as AssetCode, 'USDC', amount)
          expect(typeof converted).toBe('number')
          expect(converted).toBeGreaterThan(0)
        }
      }
    ), { numRuns: 100 })
  })

  it('Property 1: FiatService should handle all operations correctly', () => {
    fc.assert(fc.property(
      fc.constantFrom('NGN', 'USD', 'GBP'),
      fc.double({ min: 0.01, max: 100000, noNaN: true }),
      (currency, amount) => {
        const wallets = fiatService.getWallets()
        expect(Array.isArray(wallets)).toBe(true)
        expect(wallets.length).toBeGreaterThan(0)

        // Test formatting
        const formatted = fiatService.formatMoney(amount, currency as CurrencyCode)
        expect(typeof formatted).toBe('string')
        expect(formatted.length).toBeGreaterThan(0)

        // Test exchange rates
        const rate = fiatService.getExchangeRate(currency as CurrencyCode, 'USD')
        expect(typeof rate).toBe('number')
        expect(rate).toBeGreaterThan(0)
      }
    ), { numRuns: 100 })
  })

  it('Property 1: WalletService should handle all operations correctly', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 56, maxLength: 56 }),
      (address) => {
        const account = walletService.getAccountInfo()
        expect(typeof account.publicKey).toBe('string')
        expect(account.publicKey.length).toBe(56)

        const shortened = walletService.shortenKey(address)
        expect(typeof shortened).toBe('string')
        expect(shortened.includes('…')).toBe(true)

        expect(walletService.validateAddress(TEST_STELLAR_ADDRESS)).toBe(true)
      }
    ), { numRuns: 100 })
  })
})
