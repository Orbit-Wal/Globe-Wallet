import type {
  Transaction,
  TransactionCategory,
  AssetCode,
  ChartDataPoint,
  AnalyticsDashboard,
  AnalyticsMetricId,
  AnalyticsStat,
  ChartInterval,
} from '../types'

// Seeded historical volume data used as a baseline when real history is sparse.
// Values represent daily USD transaction volumes over the past 60 days.
const SEEDED_DAILY_VOLUMES = [
  820, 1140, 960, 1380, 750, 1020, 1260, 940, 1580, 1100,
  870, 1430, 990, 1650, 1200, 810, 1340, 920, 1470, 1030,
  780, 1290, 1080, 1560, 1010, 890, 1380, 970, 1620, 1150,
  840, 1420, 1060, 1500, 1020, 760, 1310, 950, 1680, 1080,
  900, 1460, 1120, 1590, 1040, 820, 1360, 980, 1630, 1170,
  860, 1440, 1070, 1520, 1030, 770, 1320, 960, 1700, 1100,
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function buildVolumeHistory(
  transactions: Transaction[],
  interval: ChartInterval,
): ChartDataPoint[] {
  switch (interval) {
    case 'day':
      return buildDailyHistory(transactions)
    case 'week':
      return buildWeeklyHistory(transactions)
    case 'month':
      return buildMonthlyHistory(transactions)
    case 'year':
      return buildYearlyHistory()
  }
}

function buildDailyHistory(transactions: Transaction[]): ChartDataPoint[] {
  const now = new Date()
  const points: ChartDataPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayIndex = d.getDay()
    const seedIdx = (SEEDED_DAILY_VOLUMES.length - 1 - i) % SEEDED_DAILY_VOLUMES.length
    const txVolume = transactions
      .filter((t) => t.type === 'send' || t.type === 'receive')
      .reduce((acc, t) => acc + t.amount * 0.12, 0)
    const base = SEEDED_DAILY_VOLUMES[seedIdx] ?? 1000
    points.push({
      label: DAY_LABELS[dayIndex] ?? 'Day',
      value: Math.round(i === 0 ? base + txVolume * 0.3 : base),
      timestamp: d.toISOString(),
    })
  }
  return points
}

function buildWeeklyHistory(transactions: Transaction[]): ChartDataPoint[] {
  const now = new Date()
  const points: ChartDataPoint[] = []
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - i * 7)
    const seedBase = SEEDED_DAILY_VOLUMES.slice(i * 7, i * 7 + 7)
    const weekTotal = seedBase.reduce((a, b) => a + b, 0)
    const label = `W${4 - i}`
    points.push({
      label,
      value: Math.round(weekTotal),
      timestamp: weekStart.toISOString(),
    })
  }
  return points
}

function buildMonthlyHistory(transactions: Transaction[]): ChartDataPoint[] {
  const now = new Date()
  const points: ChartDataPoint[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthSeedOffset = (12 - i) % 12
    const seedSlice = SEEDED_DAILY_VOLUMES.slice(monthSeedOffset * 5, monthSeedOffset * 5 + 5)
    const monthTotal = seedSlice.reduce((a, b) => a + b, 0) * 4.3
    points.push({
      label: MONTH_LABELS[d.getMonth()] ?? 'M',
      value: Math.round(monthTotal),
      timestamp: d.toISOString(),
    })
  }
  return points
}

function buildYearlyHistory(): ChartDataPoint[] {
  const now = new Date()
  const points: ChartDataPoint[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), i, 1)
    const seedSlice = SEEDED_DAILY_VOLUMES.slice(i * 5, i * 5 + 5)
    const monthTotal = seedSlice.reduce((a, b) => a + b, 0) * 4.3
    points.push({
      label: MONTH_LABELS[i] ?? 'M',
      value: Math.round(monthTotal),
      timestamp: d.toISOString(),
    })
  }
  return points
}

// ── Issue #78: downsampling/aggregation for large series ───────────────────
//
// Recharts renders one SVG primitive (path point, circle, bar, etc.) per
// data point with no built-in point-count limit. buildVolumeHistory above
// only ever produces a handful of points (7/4/6/12) since it summarizes
// fixed windows, so it never hit this — but any series built from raw
// per-day (or finer) history over a multi-year account lifetime can reach
// thousands of points, which is where Recharts' SVG rendering measurably
// degrades. downsampleChartPoints bounds the rendered point count by
// aggregating consecutive points into fixed-size time-window buckets once a
// series crosses the threshold, so a chart consumer can always request
// "detail up to N points" regardless of how much raw history it's handed.

/** Series above this many points get bucketed by downsampleChartPoints. */
export const DEFAULT_DOWNSAMPLE_THRESHOLD = 500

/**
 * Buckets `points` into groups of consecutive entries so the result has at
 * most `maxPoints` points, summing each bucket's values (the points here
 * are volume/amount totals, so summing preserves "total volume" semantics)
 * and labeling each bucket with its last (most recent) point's label and
 * timestamp. No-ops (returns `points` unchanged) when already at or under
 * the threshold, so callers can call this unconditionally.
 */
export function downsampleChartPoints(
  points: ChartDataPoint[],
  maxPoints: number = DEFAULT_DOWNSAMPLE_THRESHOLD,
): ChartDataPoint[] {
  if (maxPoints <= 0 || points.length <= maxPoints) {
    return points
  }

  const bucketSize = Math.ceil(points.length / maxPoints)
  const buckets: ChartDataPoint[] = []

  for (let i = 0; i < points.length; i += bucketSize) {
    const bucket = points.slice(i, i + bucketSize)
    if (bucket.length === 0) continue
    const sum = bucket.reduce((acc, p) => acc + p.value, 0)
    const last = bucket[bucket.length - 1]
    buckets.push({
      label: last.label,
      value: Math.round(sum * 100) / 100,
      timestamp: last.timestamp,
    })
  }

  return buckets
}

/**
 * Builds one point per calendar day covered by `transactions` (summing that
 * day's amounts), then downsamples. Unlike buildVolumeHistory's fixed
 * 7/4/6/12-point windows, this scales with however much raw history is fed
 * in — a multi-year, daily-granularity account history can produce
 * thousands of raw points before downsampling, which is the "production
 * data volume" scenario this issue is about.
 *
 * Requires transactions to carry a parseable `date` (ISO 8601 recommended).
 * Fixture data in this repo mostly uses free-form display strings (e.g.
 * "Today, 09:42") for the demo transaction list — those are skipped rather
 * than mis-bucketed, since parsing a display string as a calendar day would
 * silently corrupt the aggregation.
 */
export function buildDailySeries(
  transactions: Transaction[],
  options: { maxPoints?: number } = {},
): ChartDataPoint[] {
  if (transactions.length === 0) return []

  const byDay = new Map<string, number>()
  for (const tx of transactions) {
    const parsed = new Date(tx.date)
    if (Number.isNaN(parsed.getTime())) continue
    const key = parsed.toISOString().slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + tx.amount)
  }

  const points: ChartDataPoint[] = Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, value]) => ({
      label: day,
      value: Math.round(value * 100) / 100,
      timestamp: new Date(`${day}T00:00:00.000Z`).toISOString(),
    }))

  return downsampleChartPoints(points, options.maxPoints ?? DEFAULT_DOWNSAMPLE_THRESHOLD)
}

export function buildCategoryBreakdown(
  transactions: Transaction[],
): AnalyticsDashboard['categoryBreakdown'] {
  const map = new Map<TransactionCategory, { count: number; volume: number }>()
  for (const tx of transactions) {
    if (!tx.category) continue
    const existing = map.get(tx.category) ?? { count: 0, volume: 0 }
    map.set(tx.category, {
      count: existing.count + 1,
      volume: existing.volume + tx.amount,
    })
  }
  return Array.from(map.entries()).map(([category, stats]) => ({
    category,
    count: stats.count,
    volume: Math.round(stats.volume * 100) / 100,
  }))
}

export function buildTopAssets(
  transactions: Transaction[],
): AnalyticsDashboard['topAssets'] {
  const map = new Map<AssetCode, number>()
  for (const tx of transactions) {
    const existing = map.get(tx.asset) ?? 0
    map.set(tx.asset, existing + tx.amount)
  }
  const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([asset, volume]) => ({
      asset,
      volume: Math.round(volume * 100) / 100,
      pct: Math.round((volume / total) * 10000) / 100,
    }))
}

export function computeStat(
  id: AnalyticsMetricId,
  transactions: Transaction[],
): AnalyticsStat {
  switch (id) {
    case 'transaction_volume': {
      const volume = transactions.reduce((sum, t) => sum + t.amount * 0.12, 0)
      const prev = volume * 0.88
      const changePct = prev > 0 ? Math.round(((volume - prev) / prev) * 1000) / 10 : 0
      return {
        id,
        title: 'Transaction Volume',
        value: formatVolume(volume),
        numericValue: Math.round(volume * 100) / 100,
        change: `+${changePct}%`,
        changePct,
        trend: changePct >= 0 ? 'up' : 'down',
      }
    }
    case 'send_count': {
      const count = transactions.filter((t) => t.type === 'send').length
      return {
        id,
        title: 'Sends',
        value: String(count),
        numericValue: count,
        change: count > 0 ? '+1' : '0',
        changePct: count > 0 ? 5 : 0,
        trend: count > 0 ? 'up' : 'flat',
      }
    }
    case 'receive_count': {
      const count = transactions.filter((t) => t.type === 'receive').length
      return {
        id,
        title: 'Receives',
        value: String(count),
        numericValue: count,
        change: count > 0 ? '+2' : '0',
        changePct: count > 0 ? 8 : 0,
        trend: count > 0 ? 'up' : 'flat',
      }
    }
    case 'active_wallets': {
      const assets = new Set(transactions.map((t) => t.asset))
      const count = assets.size || 3
      return {
        id,
        title: 'Active Wallets',
        value: String(count),
        numericValue: count,
        change: '0',
        changePct: 0,
        trend: 'flat',
      }
    }
    case 'conversion_rate': {
      const converts = transactions.filter((t) => t.type === 'convert').length
      const total = transactions.length || 1
      const rate = Math.round((converts / total) * 10000) / 100
      return {
        id,
        title: 'Conversion Rate',
        value: `${rate}%`,
        numericValue: rate,
        change: '+0.5%',
        changePct: 0.5,
        trend: 'up',
      }
    }
    case 'fee_total': {
      const fees = transactions.length * 0.00001 * 0.12
      return {
        id,
        title: 'Total Fees',
        value: formatVolume(fees),
        numericValue: Math.round(fees * 10000) / 10000,
        change: '-0.2%',
        changePct: -0.2,
        trend: 'down',
      }
    }
  }
}

export function formatVolume(usdValue: number): string {
  if (usdValue >= 1_000_000) {
    return `$${(usdValue / 1_000_000).toFixed(2)}M`
  }
  if (usdValue >= 1_000) {
    return `$${(usdValue / 1_000).toFixed(1)}K`
  }
  return `$${usdValue.toFixed(2)}`
}
