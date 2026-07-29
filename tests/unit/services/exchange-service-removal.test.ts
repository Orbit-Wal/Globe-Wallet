/**
 * Dead ExchangeService removal — regression coverage.
 *
 * ExchangeService was a third fake conversion path (flat amount * 0.98) that
 * no UI ever called. Conversion remains on AssetService + conversion-math.
 */
import * as fs from 'fs'
import * as path from 'path'
import { FinanceServiceContainer } from '../../../lib/services/container'
import { AssetService } from '../../../lib/services/asset.service'
import {
  applyConversionRate,
  deriveToAmount,
  lookupRate,
} from '../../../lib/helpers/conversion-math'
import { MOCK_CONVERSION_RATES } from '../../../lib/fixtures'

describe('ExchangeService removal (dead fake DEX simulator)', () => {
  it('does not ship lib/services/exchange.service.ts', () => {
    const servicePath = path.join(
      __dirname,
      '../../../lib/services/exchange.service.ts',
    )
    expect(fs.existsSync(servicePath)).toBe(false)
  })

  it('container has no exchange property', () => {
    const container = new FinanceServiceContainer() as FinanceServiceContainer & {
      exchange?: unknown
    }
    expect(container.exchange).toBeUndefined()
    expect(Object.keys(container)).not.toContain('exchange')
  })

  it('useFinanceServices does not export useExchange', async () => {
    const hooks = await import('../../../hooks/useFinanceServices')
    expect(hooks).not.toHaveProperty('useExchange')
    expect(typeof hooks.useAssets).toBe('function')
    expect(typeof hooks.useOffRamp).toBe('function')
  })

  it('Convert-page math still works via conversion-math (adjacent path)', () => {
    const rate = 0.095
    expect(applyConversionRate(100, rate)).toBeCloseTo(9.5, 8)
    expect(deriveToAmount('100', rate)).toBe('9.500000')
    const entry = lookupRate(
      [{ from: 'XLM', to: 'USDC', rate: 0.095, change24h: 0 }],
      'XLM',
      'USDC',
    )
    expect(entry?.rate).toBe(0.095)
  })

  it('AssetService.convertAsset still works (CryptoConverter path)', () => {
    const service = new AssetService()
    const result = service.convertAsset('XLM', 'USDC', 100)
    expect(result).toBeCloseTo(100 * MOCK_CONVERSION_RATES.XLM.USDC, 8)
  })

  it('finance container still wires conversion via asset service', () => {
    const container = new FinanceServiceContainer()
    expect(container.asset).toBeInstanceOf(AssetService)
    expect(container.asset.convertAsset('XLM', 'USDC', 50)).toBeGreaterThan(0)
  })
})
