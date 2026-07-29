import { FinanceServiceContainer } from '../../lib/services/container'

describe('Service Integration Tests', () => {
  let container: FinanceServiceContainer

  beforeEach(() => {
    container = new FinanceServiceContainer()
  })

  it('should integrate all services correctly', () => {
    expect(container.wallet).toBeDefined()
    expect(container.fiat).toBeDefined()
    expect(container.pricing).toBeDefined()
    expect(container.asset).toBeDefined()
    expect((container as { exchange?: unknown }).exchange).toBeUndefined()
  })

  it('should handle cross-service operations', async () => {
    const xlmPrice = await container.pricing.getPrice('XLM')
    expect(xlmPrice).toBeGreaterThan(0)

    const usdAmount = xlmPrice * 1000
    const ngnAmount = container.fiat.convertCurrency('USD', 'NGN', usdAmount)

    expect(ngnAmount).toBeGreaterThan(0)
    expect(ngnAmount).toBeGreaterThan(usdAmount)
  })

  it('should format currencies consistently', () => {
    const xlmFormatted = container.pricing.formatAsset(1234.56, 'XLM')
    const usdFormatted = container.fiat.formatMoney(1234.56, 'USD')

    expect(xlmFormatted).toContain('XLM')
    expect(usdFormatted).toContain('$')
  })
})
