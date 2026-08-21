/**
 * Unit tests — RatesService
 *
 * Coverage targets:
 *   - getExchangeRates: happy path, cache, network error fallback, timeout fallback
 */

import { RatesService } from '../../../lib/services/rates.service'
import { MOCK_CONVERSION_RATES } from '../../../lib/fixtures'
import type { AssetCode } from '../../../lib/types'

const ALL_ASSET_CODES: AssetCode[] = ['XLM', 'USDC', 'USDT', 'NGN', 'USD', 'EUR']

describe('RatesService', () => {
  let service: RatesService
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    service = new RatesService()
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('getExchangeRates — fallback behavior', () => {
    it('falls back to mock rates on network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
      const rates = await service.getExchangeRates('XLM', ['USDC', 'USDT'])
      expect(rates.length).toBeGreaterThan(0)
    })

    it('falls back to mock rates on fetch timeout', async () => {
      // A real fetch rejects with an AbortError once its signal is aborted.
      // The mock has to honor that too, or it can't exercise the abort path at all —
      // a Promise that never settles regardless of the signal just hangs until Jest's
      // own test timeout kills it, which isn't the same thing as verifying the
      // service's 3s abort actually fires.
      global.fetch = jest.fn().mockImplementation(
        (_url: string, options?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            })
          })
      )
      const startTime = Date.now()
      const rates = await service.getExchangeRates('XLM', ['USDC', 'USDT'])
      const duration = Date.now() - startTime

      expect(duration).toBeLessThanOrEqual(5000) // should be ~3s + some overhead
      expect(rates.length).toBeGreaterThan(0)
      expect(rates[0].from).toBe('XLM')
    }, 6000)
  })

  describe('getExchangeRates — happy path', () => {
    it('returns valid rates from live fetch when available', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          stellar: { usd: 0.15 },
          'usd-coin': { usd: 1.0 },
          tether: { usd: 1.0 }
        })
      })
      
      const rates = await service.getExchangeRates('XLM', ['USDC', 'USDT'])
      expect(rates.length).toBe(2)
    })
  })

  describe('getExchangeRates — cache behavior', () => {
    it('returns cached rates within TTL', async () => {
      const mockData = {
        stellar: { usd: 0.15 },
        'usd-coin': { usd: 1.0 }
      }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      })

      const first = await service.getExchangeRates('XLM', ['USDC'])
      const second = await service.getExchangeRates('XLM', ['USDC'])

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(first).toEqual(second)
    })

    // Issue #75: concurrent cache-miss callers must coalesce into one
    // upstream fetch, not each independently call CoinGecko.
    it('coalesces concurrent cache-miss calls into a single upstream fetch', async () => {
      let resolveFetch: (v: any) => void
      global.fetch = jest.fn().mockImplementation(
        () => new Promise((resolve) => { resolveFetch = resolve }),
      )

      const p1 = service.getExchangeRates('XLM', ['USDC'])
      const p2 = service.getExchangeRates('XLM', ['USDC'])

      resolveFetch!({
        ok: true,
        json: async () => ({ stellar: { usd: 0.15 }, 'usd-coin': { usd: 1.0 } }),
      })

      const [r1, r2] = await Promise.all([p1, p2])

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(r1).toEqual(r2)
    })
  })
})
