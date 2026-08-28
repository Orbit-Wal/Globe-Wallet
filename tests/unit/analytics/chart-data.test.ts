/**
 * Issue #78 — lib/analytics/chart-data.ts had no tested behavior at
 * production data volumes. These tests cover:
 *   1. Correctness of the existing small-fixture functions (restored
 *      alongside the downsampling addition — see the module header comment
 *      for why chart-data.ts needed restoring at all).
 *   2. The new downsampling/aggregation strategy (downsampleChartPoints,
 *      buildDailySeries) with realistically large inputs — thousands of
 *      points, several years of daily transaction history.
 *   3. A perf assertion that building + downsampling a multi-year daily
 *      series stays fast, so a future regression that reintroduces
 *      unbounded per-point work gets caught here instead of in production
 *      Recharts rendering.
 */
import type { Transaction, TransactionCategory, AssetCode } from '../../../lib/types'
import {
  buildVolumeHistory,
  buildCategoryBreakdown,
  buildTopAssets,
  computeStat,
  formatVolume,
  downsampleChartPoints,
  buildDailySeries,
  DEFAULT_DOWNSAMPLE_THRESHOLD,
} from '../../../lib/analytics/chart-data'

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id ?? `tx-${Math.random().toString(36).slice(2)}`,
    type: 'send',
    amount: 100,
    asset: 'XLM',
    address: 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX',
    date: new Date().toISOString(),
    status: 'completed',
    category: 'payment',
    ...overrides,
  }
}

/**
 * Generates `count` transactions spread evenly (in day increments, several
 * per day for realism) across `years` years ending today — a stand-in for a
 * "production data volume" multi-year daily-transaction history.
 */
function generateLargeTransactionHistory(count: number, years = 4): Transaction[] {
  const assets: AssetCode[] = ['XLM', 'USDC', 'USDT']
  const categories: TransactionCategory[] = ['payment', 'exchange', 'deposit', 'withdrawal', 'transfer']
  const totalDays = years * 365
  const msPerDay = 24 * 60 * 60 * 1000
  const now = Date.now()

  const txs: Transaction[] = []
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor((i / count) * totalDays)
    const date = new Date(now - (totalDays - dayOffset) * msPerDay)
    txs.push(
      makeTx({
        id: `tx-${i}`,
        amount: 10 + (i % 500),
        asset: assets[i % assets.length],
        category: categories[i % categories.length],
        type: i % 3 === 0 ? 'receive' : 'send',
        date: date.toISOString(),
      }),
    )
  }
  return txs
}

describe('buildVolumeHistory', () => {
  it('returns 7 points for a daily interval', () => {
    const points = buildVolumeHistory([], 'day')
    expect(points).toHaveLength(7)
  })

  it('returns 4 points for a weekly interval', () => {
    expect(buildVolumeHistory([], 'week')).toHaveLength(4)
  })

  it('returns 6 points for a monthly interval', () => {
    expect(buildVolumeHistory([], 'month')).toHaveLength(6)
  })

  it('returns 12 points for a yearly interval', () => {
    expect(buildVolumeHistory([], 'year')).toHaveLength(12)
  })

  it('folds today\'s send/receive volume into the last daily point', () => {
    const base = buildVolumeHistory([], 'day')
    const withTx = buildVolumeHistory([makeTx({ type: 'send', amount: 100000 })], 'day')
    expect(withTx[withTx.length - 1].value).toBeGreaterThan(base[base.length - 1].value)
  })
})

describe('buildCategoryBreakdown', () => {
  it('aggregates count and volume per category', () => {
    const txs = [
      makeTx({ category: 'payment', amount: 100 }),
      makeTx({ category: 'payment', amount: 50 }),
      makeTx({ category: 'exchange', amount: 200 }),
    ]
    const breakdown = buildCategoryBreakdown(txs)
    const payment = breakdown.find((b) => b.category === 'payment')
    const exchange = breakdown.find((b) => b.category === 'exchange')
    expect(payment).toEqual({ category: 'payment', count: 2, volume: 150 })
    expect(exchange).toEqual({ category: 'exchange', count: 1, volume: 200 })
  })

  it('skips transactions with no category', () => {
    const txs = [makeTx({ category: undefined })]
    expect(buildCategoryBreakdown(txs)).toHaveLength(0)
  })

  it('handles thousands of transactions across a handful of categories', () => {
    const txs = generateLargeTransactionHistory(5000)
    const breakdown = buildCategoryBreakdown(txs)
    const totalCount = breakdown.reduce((sum, b) => sum + b.count, 0)
    expect(totalCount).toBe(5000)
    expect(breakdown.length).toBeLessThanOrEqual(5)
  })
})

describe('buildTopAssets', () => {
  it('sorts by volume descending and computes percentage share', () => {
    const txs = [
      makeTx({ asset: 'XLM', amount: 300 }),
      makeTx({ asset: 'USDC', amount: 100 }),
    ]
    const top = buildTopAssets(txs)
    expect(top[0].asset).toBe('XLM')
    expect(top[0].pct).toBe(75)
    expect(top[1].asset).toBe('USDC')
    expect(top[1].pct).toBe(25)
  })
})

describe('computeStat', () => {
  it('computes each known metric id without throwing', () => {
    const ids = [
      'transaction_volume',
      'send_count',
      'receive_count',
      'active_wallets',
      'conversion_rate',
      'fee_total',
    ] as const
    const txs = generateLargeTransactionHistory(200)
    for (const id of ids) {
      const stat = computeStat(id, txs)
      expect(stat.id).toBe(id)
      expect(typeof stat.value).toBe('string')
    }
  })
})

describe('formatVolume', () => {
  it('formats millions, thousands, and small values', () => {
    expect(formatVolume(2_500_000)).toBe('$2.50M')
    expect(formatVolume(4_200)).toBe('$4.2K')
    expect(formatVolume(42.5)).toBe('$42.50')
  })
})

describe('downsampleChartPoints (Issue #78)', () => {
  function points(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      label: `p${i}`,
      value: i,
      timestamp: new Date(2020, 0, 1 + i).toISOString(),
    }))
  }

  it('is a no-op when the series is already within the threshold', () => {
    const input = points(300)
    expect(downsampleChartPoints(input, 500)).toEqual(input)
  })

  it('bounds the output to at most maxPoints for a large series', () => {
    const input = points(10_000)
    const result = downsampleChartPoints(input, 500)
    expect(result.length).toBeLessThanOrEqual(500)
    expect(result.length).toBeGreaterThan(0)
  })

  it('preserves total volume across buckets (sum-aggregation)', () => {
    const input = points(2000)
    const result = downsampleChartPoints(input, 200)
    const inputTotal = input.reduce((sum, p) => sum + p.value, 0)
    const outputTotal = result.reduce((sum, p) => sum + p.value, 0)
    expect(outputTotal).toBeCloseTo(inputTotal, 5)
  })

  it('handles a threshold of 1 without throwing or looping infinitely', () => {
    const result = downsampleChartPoints(points(50), 1)
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(50)
  })
})

describe('buildDailySeries at production data volumes (Issue #78)', () => {
  it('downsamples several years of daily transaction history under the default threshold', () => {
    // ~4 years of realistic daily transaction volume, several transactions
    // per day (5,000 transactions across ~1,460 calendar days).
    const txs = generateLargeTransactionHistory(5000, 4)
    const series = buildDailySeries(txs)
    expect(series.length).toBeLessThanOrEqual(DEFAULT_DOWNSAMPLE_THRESHOLD)
    expect(series.length).toBeGreaterThan(0)
    for (const point of series) {
      expect(Number.isFinite(point.value)).toBe(true)
      expect(() => new Date(point.timestamp).toISOString()).not.toThrow()
    }
  })

  it('respects an explicit maxPoints override', () => {
    const txs = generateLargeTransactionHistory(3000, 3)
    const series = buildDailySeries(txs, { maxPoints: 50 })
    expect(series.length).toBeLessThanOrEqual(50)
  })

  it('skips transactions with an unparseable date instead of corrupting buckets', () => {
    const txs = [makeTx({ date: 'Today, 09:42' }), makeTx({ date: new Date().toISOString() })]
    expect(() => buildDailySeries(txs)).not.toThrow()
    expect(buildDailySeries(txs).length).toBe(1)
  })

  it('completes in well under a second for a large multi-year, high-frequency dataset', () => {
    // Denser than a typical wallet: ~20 transactions/day over 5 years
    // (36,500 transactions) — well past the few-thousand-point range where
    // Recharts' unthrottled SVG rendering starts to degrade, to make sure
    // the aggregation step itself isn't the bottleneck.
    const txs = generateLargeTransactionHistory(36_500, 5)

    const start = Date.now()
    const series = buildDailySeries(txs)
    const elapsedMs = Date.now() - start

    expect(series.length).toBeLessThanOrEqual(DEFAULT_DOWNSAMPLE_THRESHOLD)
    // Generous budget for CI-noise tolerance while still catching an
    // accidental O(n^2) regression (e.g. an .indexOf/.find per point).
    expect(elapsedMs).toBeLessThan(1000)
  })
})
