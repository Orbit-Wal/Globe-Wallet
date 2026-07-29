import { MOCK_CLAIMABLE_BALANCES, TOTAL_CLAIMABLE_AMOUNT, CLAIMABLE_BALANCES_BY_ASSET } from '../../lib/fixtures/claimable-balances'
import { FixtureFactory } from '../../lib/fixtures/factory'

describe('Claimable Balances (Issue #99)', () => {
  it('should contain 3 mock claimable balances', () => {
    expect(MOCK_CLAIMABLE_BALANCES).toHaveLength(3)
  })

  it('should have valid ClaimableBalance shape', () => {
    for (const b of MOCK_CLAIMABLE_BALANCES) {
      expect(b).toHaveProperty('id')
      expect(b).toHaveProperty('balanceId')
      expect(b).toHaveProperty('asset')
      expect(b).toHaveProperty('amount')
      expect(b).toHaveProperty('claimants')
      expect(b).toHaveProperty('status')
      expect(b).toHaveProperty('createdAt')
      expect(typeof b.id).toBe('string')
      expect(typeof b.balanceId).toBe('string')
      expect(typeof b.amount).toBe('number')
      expect(b.amount).toBeGreaterThan(0)
    }
  })

  it('should cover USDC, XLM, and USDT assets', () => {
    const assets = MOCK_CLAIMABLE_BALANCES.map((b) => b.asset)
    expect(assets).toContain('USDC')
    expect(assets).toContain('XLM')
    expect(assets).toContain('USDT')
  })

  it('should have valid total claimable amount', () => {
    expect(TOTAL_CLAIMABLE_AMOUNT).toBeGreaterThan(0)
    expect(TOTAL_CLAIMABLE_AMOUNT).toBe(850.5) // 100.5 + 500 + 250
  })

  it('should have correct asset breakdown', () => {
    expect(CLAIMABLE_BALANCES_BY_ASSET.XLM).toBe(500)
    expect(CLAIMABLE_BALANCES_BY_ASSET.USDC).toBe(100.5)
    expect(CLAIMABLE_BALANCES_BY_ASSET.USDT).toBe(250)
  })

  it('should be exportable from FixtureFactory', () => {
    const factoryBalances = FixtureFactory.getClaimableBalances()
    expect(factoryBalances).toHaveLength(3)
    expect(factoryBalances[0].asset).toBe('USDC')
  })

  it('should be creatable dynamically via FixtureFactory', () => {
    const balance = FixtureFactory.createClaimableBalance({ amount: 200 })
    expect(balance.amount).toBe(200)
    expect(balance.status).toBe('available')
  })
})
