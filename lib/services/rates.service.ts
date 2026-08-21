import { BaseService } from './base.service'
import { MOCK_CONVERSION_RATES } from '../fixtures/rates'
import { AssetCode } from '../types'

export interface ExchangeRate {
  from: string
  to: string
  rate: number
  change24h: number
}

// Issue #75: `cache` is instance-scoped. In a serverless/edge deployment
// (typical for Next.js App Router routes) each invocation may get a fresh
// RatesService instance, so this cache is a real, working TTL cache in a
// long-lived process (local dev, a persistent container) but can be close
// to a no-op in a serverless/edge target. Fixing that for real needs a
// store that outlives the instance (Redis, edge KV) — deliberately not
// added here per this issue's own "or documented as dev-only" DoD option,
// since wiring a real external cache store is separate infra work. What IS
// fixed here: concurrent cache-miss requests no longer each hit CoinGecko
// independently (the stampede half of this issue), via in-flight promise
// dedup below — that fix is real and instance-scoped-cache-agnostic.
export class RatesService extends BaseService {
  private cache: Map<string, { rates: ExchangeRate[]; timestamp: number }> = new Map()
  private inFlight: Map<string, Promise<ExchangeRate[]>> = new Map()
  private readonly cacheTTL = 60000 // 1 minute
  private readonly fetchTimeout = 3000 // 3 seconds

  constructor() {
    super('RatesService')
  }

  async getExchangeRates(from: AssetCode, supportedCurrencies: AssetCode[]): Promise<ExchangeRate[]> {
    return this.withPerformanceTracking('getExchangeRates', async () => {
      const cacheKey = `${from}-${supportedCurrencies.join(',')}`
      const cached = this.cache.get(cacheKey)
      const now = Date.now()

      if (cached && (now - cached.timestamp) < this.cacheTTL) {
        return cached.rates
      }

      // Coalesce concurrent cache-miss callers for the same key into one
      // upstream fetch instead of each independently calling CoinGecko.
      const existing = this.inFlight.get(cacheKey)
      if (existing) {
        return existing
      }

      const fetchPromise = (async () => {
        try {
          const rates = await this.fetchLiveRates(from, supportedCurrencies)
          this.cache.set(cacheKey, { rates, timestamp: Date.now() })
          return rates
        } catch (error) {
          console.warn('[RatesService] Failed to fetch live rates, falling back to mock data', error)
          return this.getMockRates(from, supportedCurrencies)
        } finally {
          this.inFlight.delete(cacheKey)
        }
      })()

      this.inFlight.set(cacheKey, fetchPromise)
      return fetchPromise
    })
  }

  private async fetchLiveRates(from: AssetCode, supportedCurrencies: AssetCode[]): Promise<ExchangeRate[]> {
    const coinIds: Record<AssetCode, string> = {
      XLM: 'stellar',
      USDC: 'usd-coin',
      USDT: 'tether',
      NGN: 'nigerian-naira',
      USD: 'usd',
      EUR: 'eur',
    }

    const fromCoinId = coinIds[from]
    if (!fromCoinId) {
      throw new Error(`Unsupported asset: ${from}`)
    }

    const coinIdsToFetch = [
      fromCoinId,
      ...supportedCurrencies
        .filter((c) => c !== from)
        .map((c) => coinIds[c])
        .filter(Boolean),
    ]

    const params = new URLSearchParams({
      ids: coinIdsToFetch.join(','),
      vs_currencies: 'usd',
      include: 'market_cap_change_24h_in_currency',
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeout)

    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?${params.toString()}`,
        { 
          next: { revalidate: 60 },
          signal: controller.signal
        }
      )

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`)
      }

      const data = await response.json()
      const rates: ExchangeRate[] = []
      const fromPriceUsd = data[fromCoinId]?.usd

      if (!fromPriceUsd) {
        throw new Error(`Could not fetch price for ${from}`)
      }

      supportedCurrencies.forEach((to) => {
        if (to === from) return

        const toCoinId = coinIds[to]
        const toPriceUsd = data[toCoinId]?.usd

        if (toPriceUsd !== undefined && typeof toPriceUsd === 'number') {
          rates.push({
            from,
            to,
            rate: toPriceUsd / fromPriceUsd,
            change24h: 0,
          })
        }
      })

      return rates
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private getMockRates(from: AssetCode, supportedCurrencies: AssetCode[]): ExchangeRate[] {
    const mockRates: ExchangeRate[] = []
    const fromRates = MOCK_CONVERSION_RATES[from]

    if (!fromRates) {
      return []
    }

    supportedCurrencies.forEach((to) => {
      if (to !== from && fromRates[to]) {
        mockRates.push({
          from,
          to,
          rate: fromRates[to],
          change24h: 0,
        })
      }
    })

    return mockRates
  }
}

export const ratesService = new RatesService()
