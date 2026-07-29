/** @jest-environment node */

// Real StrKey/TransactionBuilder/Keypair/Asset/Memo are used as-is (via
// requireActual) — only the network-facing Horizon.Server calls are faked,
// so these tests exercise real transaction building/signing without ever
// hitting the network. See tests/unit/services/stellar-payment.service.test.ts
// for isolated coverage of the completed/pending/failed status mapping.
const mockLoadAccount = jest.fn()
const mockSubmitTransaction = jest.fn()

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk')
  class MockHorizonServer {
    constructor(_url: string) {
      void _url
    }
    loadAccount(...args: unknown[]) {
      return mockLoadAccount(...args)
    }
    submitTransaction(...args: unknown[]) {
      return mockSubmitTransaction(...args)
    }
  }
  return { ...actual, Horizon: { ...actual.Horizon, Server: MockHorizonServer } }
})

import { NextRequest } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { GET as balancesGET } from '../../app/api/wallet/balances/route'
import { POST as sendPOST } from '../../app/api/wallet/send/route'
import { GET as transactionsGET } from '../../app/api/wallet/transactions/route'
import { GET as ratesGET } from '../../app/api/rates/route'
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base'
import { initTracing } from '../../lib/tracing/tracer'

// Throwaway keypair used only to sign in-memory test transactions — never
// funded, never submitted to a real network.
const TEST_SOURCE_SECRET = 'SCKSUCB5MRRIVQUWM5EFVWDWJAGAMXLP5Y4HL5VMX7KQJGS42OOU73C5'
const TEST_SOURCE_PUBLIC_KEY = 'GCVEVGZLNDWWIPMM3B4Q76ZPSZOCDXTMMG2MLZMJBQURLNSB7NRU4PTB'

process.env.STELLAR_HORIZON_URL = 'https://horizon-testnet.stellar.org'
process.env.STELLAR_SOURCE_SECRET_KEY = TEST_SOURCE_SECRET
process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet'

describe('Wallet Mock API Routes Integration', () => {
  describe('/api/wallet/balances', () => {
    it('GET should return list of mock balances', async () => {
      const response = await balancesGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data[0]).toHaveProperty('asset')
      expect(data[0]).toHaveProperty('amount')
      expect(data[0]).toHaveProperty('priceUsd')
    })
  })

  describe('/api/wallet/transactions', () => {
    it('GET should return mock transaction history with category, name, and detail fields', async () => {
      const response = await transactionsGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data[0]).toHaveProperty('id')
      expect(data[0]).toHaveProperty('category')
      expect(data[0]).toHaveProperty('name')
      expect(data[0]).toHaveProperty('detail')
    })
  })

  describe('/api/rates', () => {
    it('GET should return mock conversion rates', async () => {
      const response = await ratesGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('rates')
      expect(data).toHaveProperty('updatedAt')
      expect(data.rates).toHaveProperty('XLM_USD')
      expect(data.rates).toHaveProperty('NGN_USD')
    })
  })

  describe('/api/wallet/send', () => {
    const validAddr = 'GBID26P7CMFHLDFV35TT5RKQHTA6QARBYCBCNW2QIXVPMKE6MSE3FCDV'

    beforeEach(() => {
      jest.clearAllMocks()
      mockLoadAccount.mockResolvedValue(
        new StellarSdk.Account(TEST_SOURCE_PUBLIC_KEY, '1'),
      )
      mockSubmitTransaction.mockResolvedValue({
        hash: 'b'.repeat(64),
        ledger: 999,
        successful: true,
      })
    })

    it('POST should execute payment successfully on valid inputs', async () => {
      const request = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },

        body: JSON.stringify({
          destination: validAddr,
          amount: 50.5,
          asset: 'XLM',
          memo: 'Integration test'
        })
      })

      const response = await sendPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('hash', 'b'.repeat(64))
      expect(data).toHaveProperty('status', 'completed')
      expect(mockSubmitTransaction).toHaveBeenCalledTimes(1)
    })

    it('POST should report status failed with a real hash when Horizon rejects the transaction', async () => {
      const horizonError = new Error('Request failed with status code 400')
      ;(horizonError as any).response = {
        status: 400,
        data: { extras: { result_codes: { transaction: 'tx_failed', operations: ['op_underfunded'] } } },
      }
      mockSubmitTransaction.mockRejectedValue(horizonError)

      const request = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
        body: JSON.stringify({ destination: validAddr, amount: 50.5, asset: 'XLM' }),
      })

      const response = await sendPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(false)
      expect(data.status).toBe('failed')
      expect(data.hash).toMatch(/^[0-9a-f]{64}$/)
      expect(data.error).toContain('op_underfunded')
    })

    it('POST should report status pending (not success:false) when Horizon never responds', async () => {
      mockSubmitTransaction.mockRejectedValue(new Error('timeout of 60000ms exceeded'))

      const request = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
        body: JSON.stringify({ destination: validAddr, amount: 50.5, asset: 'XLM' }),
      })

      const response = await sendPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('pending')
      expect(data.success).toBe(true)
      expect(data.hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('POST should reject an unsupported asset before touching the network', async () => {
      const request = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
        body: JSON.stringify({ destination: validAddr, amount: 10, asset: 'DOGE' }),
      })

      const response = await sendPOST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('ERR_UNSUPPORTED_ASSET')
      expect(mockLoadAccount).not.toHaveBeenCalled()
    })

    it('POST should reject a memo longer than 28 bytes before touching the network', async () => {
      const request = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
        body: JSON.stringify({ destination: validAddr, amount: 10, asset: 'XLM', memo: 'a'.repeat(29) }),
      })

      const response = await sendPOST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('ERR_MEMO_TOO_LONG')
      expect(mockLoadAccount).not.toHaveBeenCalled()
    })

    // ERR_PAYMENT_NOT_CONFIGURED (signing key env var unset) is covered in
    // tests/integration/wallet-send-unconfigured.test.ts, which needs the
    // module loaded with that var absent for the whole file rather than
    // toggled mid-suite.

    it('POST should reject invalid address', async () => {
      const request = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },

        body: JSON.stringify({
          destination: 'invalid-stellar-key',
          amount: 50.5,
          asset: 'XLM'
        })
      })

      const response = await sendPOST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('not a valid Stellar public key')
    })

    it('POST should reject missing address', async () => {
      const request = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },

        body: JSON.stringify({
          amount: 50.5,
          asset: 'XLM'
        })
      })

      const response = await sendPOST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('destination is required')
    })

    it('POST should reject negative or zero amount', async () => {
      const request = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },

        body: JSON.stringify({
          destination: validAddr,
          amount: -5,
          asset: 'XLM'
        })
      })

      const response = await sendPOST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('amount must be a positive number')
    })

    it('POST should reject missing asset', async () => {
      const request = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },

        body: JSON.stringify({
          destination: validAddr,
          amount: 10
        })
      })

      const response = await sendPOST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('asset is required')
    })

    it('POST should reject malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },

        body: 'malformed-json-string'
      })

      const response = await sendPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Invalid JSON body')
    })

    describe('trace propagation (Issue #103)', () => {
      const exporter = new InMemorySpanExporter()

      beforeAll(() => {
        initTracing(exporter)
      })

      beforeEach(() => {
        exporter.reset()
      })

      it('continues the caller trace from an incoming traceparent header instead of starting a new one', async () => {
        const callerTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
        const callerSpanId = '00f067aa0ba902b7'
        const traceparent = `00-${callerTraceId}-${callerSpanId}-01`

        const request = new NextRequest('http://localhost/api/wallet/send', {
          method: 'POST',
          headers: { traceparent, Authorization: 'Bearer test-token' },
          body: JSON.stringify({
            destination: validAddr,
            amount: 25,
            asset: 'XLM',
          }),
        })

        const response = await sendPOST(request)
        expect(response.status).toBe(200)

        const spans = exporter.getFinishedSpans()
        const serverSpan = spans.find((s) => s.name === 'api.wallet.send')
        expect(serverSpan).toBeDefined()
        expect(serverSpan!.spanContext().traceId).toBe(callerTraceId)
        expect(serverSpan!.parentSpanContext?.spanId).toBe(callerSpanId)
      })

      it('starts a fresh trace when no traceparent header is present', async () => {
        const request = new NextRequest('http://localhost/api/wallet/send', {
          method: 'POST',
          headers: { Authorization: 'Bearer test-token' },
          body: JSON.stringify({ destination: validAddr, amount: 25, asset: 'XLM' }),
        })

        const response = await sendPOST(request)
        expect(response.status).toBe(200)

        const spans = exporter.getFinishedSpans()
        const serverSpan = spans.find((s) => s.name === 'api.wallet.send')
        expect(serverSpan).toBeDefined()
        expect(serverSpan!.parentSpanContext).toBeUndefined()
      })
    })
  })
})
