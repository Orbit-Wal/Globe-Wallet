/**
 * Unit tests — PathPaymentService (Issue #98)
 *
 * Coverage targets:
 *   - findQuote with strictSend mode
 *   - findQuote with strictReceive mode
 *   - Same asset direct 1:1 conversion
 *   - No path found scenario (NoPathFoundError)
 *   - Network failure handling
 *   - Slippage tolerance calculation (destMin & sendMax)
 *   - executePayment with valid & stale quotes
 *   - Transaction building for PathPaymentStrictSend and PathPaymentStrictReceive
 */

import { PathPaymentService } from '../../../lib/services/path-payment.service'
import { NoPathFoundError, SlippageExceededError, StaleQuoteError, PaymentQuote } from '../../../lib/types'

describe('PathPaymentService', () => {
  let service: PathPaymentService
  let mockServer: any

  beforeEach(() => {
    mockServer = {
      strictSendPaths: jest.fn(),
      strictReceivePaths: jest.fn(),
      loadAccount: jest.fn(),
      submitTransaction: jest.fn(),
    }
    service = new PathPaymentService('https://horizon-testnet.stellar.org', mockServer)
  })

  describe('findQuote — strictSend mode', () => {
    it('returns a valid PaymentQuote when a path is found', async () => {
      mockServer.strictSendPaths.mockReturnValue({
        call: jest.fn().mockResolvedValue({
          records: [
            {
              destination_amount: '11.8500000',
              path: [{ asset_type: 'credit_alphanum4', asset_code: 'USDT', asset_issuer: 'GCQT...' }],
            },
          ],
        }),
      })

      const quote = await service.findQuote({
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        amount: '100',
        mode: 'strictSend',
        slippageTolerance: 0.5,
      })

      expect(quote.mode).toBe('strictSend')
      expect(quote.sourceAsset).toBe('XLM')
      expect(quote.destinationAsset).toBe('USDC')
      expect(quote.executableSourceAmount).toBe('100.0000000')
      expect(quote.executableDestinationAmount).toBe('11.8500000')
      expect(quote.estimatedPrice).toBeCloseTo(0.1185, 4)
      expect(quote.slippageTolerance).toBe(0.5)
      // destMin = 11.85 * (1 - 0.005) = 11.7907500
      expect(parseFloat(quote.destMin)).toBeLessThan(11.85)
      expect(quote.sendMax).toBe('100.0000000')
      expect(quote.path.length).toBe(1)
    })

    it('throws NoPathFoundError when no records are returned', async () => {
      mockServer.strictSendPaths.mockReturnValue({
        call: jest.fn().mockResolvedValue({ records: [] }),
      })

      await expect(
        service.findQuote({
          sourceAsset: 'XLM',
          destinationAsset: 'USDC',
          amount: '100',
          mode: 'strictSend',
        })
      ).rejects.toThrow(NoPathFoundError)
    })
  })

  describe('findQuote — strictReceive mode', () => {
    it('returns a valid PaymentQuote for destination-driven amount', async () => {
      mockServer.strictReceivePaths.mockReturnValue({
        call: jest.fn().mockResolvedValue({
          records: [
            {
              source_amount: '84.3880000',
              path: [],
            },
          ],
        }),
      })

      const quote = await service.findQuote({
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        amount: '10',
        mode: 'strictReceive',
        slippageTolerance: 1.0,
      })

      expect(quote.mode).toBe('strictReceive')
      expect(quote.executableDestinationAmount).toBe('10.0000000')
      expect(quote.executableSourceAmount).toBe('84.3880000')
      // sendMax = 84.388 * 1.01 = 85.23188
      expect(parseFloat(quote.sendMax)).toBeGreaterThan(84.388)
      expect(quote.destMin).toBe('10.0000000')
    })

    it('throws NoPathFoundError on empty strictReceive response', async () => {
      mockServer.strictReceivePaths.mockReturnValue({
        call: jest.fn().mockResolvedValue({ records: [] }),
      })

      await expect(
        service.findQuote({
          sourceAsset: 'XLM',
          destinationAsset: 'USDC',
          amount: '10',
          mode: 'strictReceive',
        })
      ).rejects.toThrow(NoPathFoundError)
    })
  })

  describe('findQuote — same asset direct 1:1 conversion', () => {
    it('returns 1:1 direct quote for same source and destination asset', async () => {
      const quote = await service.findQuote({
        sourceAsset: 'XLM',
        destinationAsset: 'XLM',
        amount: '50',
        mode: 'strictSend',
      })

      expect(quote.executableSourceAmount).toBe('50.0000000')
      expect(quote.executableDestinationAmount).toBe('50.0000000')
      expect(quote.estimatedPrice).toBe(1.0)
      expect(quote.path.length).toBe(0)
    })
  })

  describe('findQuote — error handling & validation', () => {
    it('throws error for non-positive amount input', async () => {
      await expect(
        service.findQuote({
          sourceAsset: 'XLM',
          destinationAsset: 'USDC',
          amount: '-5',
          mode: 'strictSend',
        })
      ).rejects.toThrow('Invalid amount')
    })

    it('handles Horizon network failure gracefully', async () => {
      mockServer.strictSendPaths.mockReturnValue({
        call: jest.fn().mockRejectedValue(new Error('Network failure: Connection refused')),
      })

      await expect(
        service.findQuote({
          sourceAsset: 'XLM',
          destinationAsset: 'USDC',
          amount: '100',
          mode: 'strictSend',
        })
      ).rejects.toThrow(/Network failure/)
    })
  })

  describe('executePayment', () => {
    it('executes simulated payment when no secret is provided', async () => {
      const validQuote: PaymentQuote = {
        mode: 'strictSend',
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        executableSourceAmount: '100.0000000',
        executableDestinationAmount: '9.5000000',
        path: [],
        estimatedPrice: 0.095,
        priceImpact: 0,
        slippageTolerance: 0.5,
        destMin: '9.4525000',
        sendMax: '100.0000000',
        expiresAt: Date.now() + 15000,
        createdAt: Date.now(),
      }

      const result = await service.executePayment({ quote: validQuote })
      expect(result.success).toBe(true)
      expect(result.hash).toBeDefined()
    })

    it('throws StaleQuoteError when executing an expired quote', async () => {
      const expiredQuote: PaymentQuote = {
        mode: 'strictSend',
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        executableSourceAmount: '100.0000000',
        executableDestinationAmount: '9.5000000',
        path: [],
        estimatedPrice: 0.095,
        priceImpact: 0,
        slippageTolerance: 0.5,
        destMin: '9.4525000',
        sendMax: '100.0000000',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        createdAt: Date.now() - 16000,
      }

      await expect(service.executePayment({ quote: expiredQuote })).rejects.toThrow(StaleQuoteError)
    })
  })
})
