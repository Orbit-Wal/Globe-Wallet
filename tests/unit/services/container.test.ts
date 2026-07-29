import { FinanceServiceContainer } from '../../../lib/services/container'
import { WalletService } from '../../../lib/services/wallet.service'
import { OffRampService } from '../../../lib/services/off-ramp.service'
import { PricingService } from '../../../lib/services/pricing.service'
import { FiatService } from '../../../lib/services/fiat.service'
import { SorobanMockService } from '../../../lib/services/soroban.service.mock'
import { AssetService } from '../../../lib/services/asset.service'
import { StellarService } from '../../../lib/services/stellar.service'

describe('FinanceServiceContainer', () => {
  it('should create with default services', () => {
    const container = new FinanceServiceContainer()
    expect(container.wallet).toBeInstanceOf(WalletService)
    expect(container.offRamp).toBeInstanceOf(OffRampService)
    expect(container.pricing).toBeInstanceOf(PricingService)
    expect(container.fiat).toBeInstanceOf(FiatService)
    expect(container.soroban).toBeInstanceOf(SorobanMockService)
    expect(container.asset).toBeInstanceOf(AssetService)
    expect(container.stellar).toBeInstanceOf(StellarService)
  })

  it('should not expose a removed ExchangeService slot', () => {
    const container = new FinanceServiceContainer() as FinanceServiceContainer & {
      exchange?: unknown
    }
    expect(container.exchange).toBeUndefined()
    expect('exchange' in container).toBe(false)
  })

  it('should accept injected services', () => {
    const mockWallet = {} as any
    const mockOffRamp = {} as any
    const mockPricing = {} as any
    const mockFiat = {} as any

    const container = new FinanceServiceContainer(
      mockWallet,
      mockOffRamp,
      mockPricing,
      mockFiat
    )
    expect(container.wallet).toBe(mockWallet)
    expect(container.offRamp).toBe(mockOffRamp)
    expect(container.pricing).toBe(mockPricing)
    expect(container.fiat).toBe(mockFiat)
  })

  it('should respect ContainerConfig.environment=mock', () => {
    const container = new FinanceServiceContainer(
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, { environment: 'mock' }
    )
    expect(container.wallet).toBeInstanceOf(WalletService)
    expect(container.offRamp).toBeInstanceOf(OffRampService)
    expect(container.pricing).toBeInstanceOf(PricingService)
    expect(container.fiat).toBeInstanceOf(FiatService)
    expect(container.soroban).toBeInstanceOf(SorobanMockService)
    expect(container.asset).toBeInstanceOf(AssetService)
    expect(container.stellar).toBeInstanceOf(StellarService)
  })

  it('should fall back to mock when live factory is missing', () => {
    // Only 'soroban' has a live factory; other services use mock for all modes.
    const container = new FinanceServiceContainer(
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, { environment: 'live' }
    )
    expect(container.wallet).toBeInstanceOf(WalletService)
    expect(container.stellar).toBeInstanceOf(StellarService)
  })

  it('should apply per-service override over environment', () => {
    const container = new FinanceServiceContainer(
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined,
      { environment: 'live', services: { wallet: 'mock' } }
    )
    // wallet should get mock (per-service override wins)
    expect(container.wallet).toBeInstanceOf(WalletService)
    // stellar falls back to environment='live' → then to mock (no live factory)
    expect(container.stellar).toBeInstanceOf(StellarService)
  })

  it('should let injected services override config', () => {
    const mockWallet = { getAccountInfo: () => ({ publicKey: 'injected' }) } as any
    const container = new FinanceServiceContainer(
      mockWallet, undefined, undefined, undefined,
      undefined, undefined, undefined, { environment: 'live' }
    )
    expect(container.wallet.getAccountInfo().publicKey).toBe('injected')
  })
})
