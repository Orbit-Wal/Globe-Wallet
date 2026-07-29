import {
  buildVolumeHistory,
  buildCategoryBreakdown,
  buildTopAssets,
  computeStat,
  formatVolume,
} from '../../../lib/analytics/chart-data'
import type { Transaction } from '../../../lib/types'

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  type: 'send',
  amount: 100,
  asset: 'XLM',
  address: 'GAAA...',
  date: 'Today, 09:00',
  status: 'completed',
  category: 'payment',
  ...overrides,
})

describe('buildVolumeHistory', () => {
  it('returns 7 points for day interval', () => {
    const points = buildVolumeHistory([], 'day')
    expect(points).toHaveLength(7)
    points.forEach((p) => {
      expect(p).toHaveProperty('label')
      expect(p).toHaveProperty('value')
      expect(typeof p.value).toBe('number')
      expect(p.value).toBeGreaterThan(0)
    })
  })

  it('returns 4 points for week interval', () => {
    const points = buildVolumeHistory([], 'week')
    expect(points).toHaveLength(4)
  })

  it('returns 6 points for month interval', () => {
    const points = buildVolumeHistory([], 'month')
    expect(points).toHaveLength(6)
  })

  it('returns 12 points for year interval', () => {
    const points = buildVolumeHistory([], 'year')
    expect(points).toHaveLength(12)
  })

  it('includes a timestamp field on each point', () => {
    const points = buildVolumeHistory([], 'day')
    points.forEach((p) => {
      expect(p.timestamp).toBeDefined()
      expect(() => new Date(p.timestamp!)).not.toThrow()
    })
  })

  it('incorporates transaction volume into today\'s daily point', () => {
    const txs = [
      makeTransaction({ type: 'send',    amount: 10000 }),
      makeTransaction({ type: 'receive', amount: 5000  }),
    ]
    const withTx    = buildVolumeHistory(txs, 'day')
    const withoutTx = buildVolumeHistory([],  'day')
    const todayWith    = withTx[withTx.length - 1].value
    const todayWithout = withoutTx[withoutTx.length - 1].value
    expect(todayWith).toBeGreaterThanOrEqual(todayWithout)
  })
})

describe('buildCategoryBreakdown', () => {
  it('returns empty array for no transactions', () => {
    expect(buildCategoryBreakdown([])).toEqual([])
  })

  it('skips transactions without a category', () => {
    const txs = [makeTransaction({ category: undefined })]
    expect(buildCategoryBreakdown(txs)).toEqual([])
  })

  it('aggregates counts and volumes by category', () => {
    const txs = [
      makeTransaction({ amount: 100, category: 'payment'  }),
      makeTransaction({ amount: 200, category: 'payment'  }),
      makeTransaction({ amount: 300, category: 'exchange' }),
    ]
    const result = buildCategoryBreakdown(txs)
    const payment = result.find((r) => r.category === 'payment')
    const exchange = result.find((r) => r.category === 'exchange')
    expect(payment).toMatchObject({ count: 2, volume: 300 })
    expect(exchange).toMatchObject({ count: 1, volume: 300 })
  })

  it('rounds volume to 2 decimal places', () => {
    const txs = [makeTransaction({ amount: 1.1 })]
    const result = buildCategoryBreakdown(txs)
    expect(result[0].volume).toBe(1.1)
  })
})

describe('buildTopAssets', () => {
  it('returns empty array for no transactions', () => {
    expect(buildTopAssets([])).toEqual([])
  })

  it('sorts assets by volume descending', () => {
    const txs = [
      makeTransaction({ asset: 'USDC', amount: 500 }),
      makeTransaction({ asset: 'XLM',  amount: 1000 }),
      makeTransaction({ asset: 'USDT', amount: 200 }),
    ]
    const result = buildTopAssets(txs)
    expect(result[0].asset).toBe('XLM')
    expect(result[1].asset).toBe('USDC')
    expect(result[2].asset).toBe('USDT')
  })

  it('computes correct percentages summing to ~100%', () => {
    const txs = [
      makeTransaction({ asset: 'XLM',  amount: 600 }),
      makeTransaction({ asset: 'USDC', amount: 400 }),
    ]
    const result = buildTopAssets(txs)
    const totalPct = result.reduce((sum, r) => sum + r.pct, 0)
    expect(totalPct).toBeCloseTo(100, 1)
  })
})

describe('computeStat', () => {
  const txs = [
    makeTransaction({ type: 'send',    amount: 500, asset: 'XLM'  }),
    makeTransaction({ type: 'receive', amount: 300, asset: 'USDC' }),
    makeTransaction({ type: 'convert', amount: 100, asset: 'XLM'  }),
  ]

  it('computes transaction_volume stat', () => {
    const stat = computeStat('transaction_volume', txs)
    expect(stat.id).toBe('transaction_volume')
    expect(stat.numericValue).toBeGreaterThan(0)
    expect(stat.trend).toBe('up')
    expect(stat.value).toMatch(/^\$/)
  })

  it('computes send_count stat', () => {
    const stat = computeStat('send_count', txs)
    expect(stat.id).toBe('send_count')
    expect(stat.numericValue).toBe(1)
  })

  it('computes receive_count stat', () => {
    const stat = computeStat('receive_count', txs)
    expect(stat.id).toBe('receive_count')
    expect(stat.numericValue).toBe(1)
  })

  it('computes active_wallets stat reflecting unique assets', () => {
    const stat = computeStat('active_wallets', txs)
    expect(stat.id).toBe('active_wallets')
    expect(stat.numericValue).toBe(2)
  })

  it('computes conversion_rate stat', () => {
    const stat = computeStat('conversion_rate', txs)
    expect(stat.id).toBe('conversion_rate')
    expect(stat.value).toMatch(/%$/)
  })

  it('computes fee_total stat', () => {
    const stat = computeStat('fee_total', txs)
    expect(stat.id).toBe('fee_total')
    expect(stat.trend).toBe('down')
  })

  it('handles empty transactions gracefully', () => {
    const stat = computeStat('send_count', [])
    expect(stat.numericValue).toBe(0)
    expect(stat.trend).toBe('flat')
  })
})

describe('formatVolume', () => {
  it('formats values under $1K with 2 decimal places', () => {
    expect(formatVolume(0)).toBe('$0.00')
    expect(formatVolume(999.99)).toBe('$999.99')
  })

  it('formats thousands with K suffix', () => {
    expect(formatVolume(1000)).toBe('$1.0K')
    expect(formatVolume(5500)).toBe('$5.5K')
  })

  it('formats millions with M suffix', () => {
    expect(formatVolume(1_000_000)).toBe('$1.00M')
    expect(formatVolume(2_500_000)).toBe('$2.50M')
  })
})
