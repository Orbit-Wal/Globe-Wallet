/** @jest-environment node */

// Only the network-facing Horizon.Server calls are faked here — StrKey,
// TransactionBuilder, Keypair, Asset, and Memo are the real SDK (via
// requireActual), so /api/wallet/send still does real transaction
// building/signing in this test, it just never reaches the network.
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
import { GET as transactionsGET } from '../../app/api/wallet/transactions/route'
import { POST as sendPOST } from '../../app/api/wallet/send/route'
import { GET as ratesGET } from '../../app/api/rates/route'
import { FixtureFactory } from '../../lib/fixtures'
import { TEST_STELLAR_ADDRESS } from '../../lib/fixtures/stellar'

// Throwaway keypair used only to sign in-memory test transactions — never
// funded, never submitted to a real network.
const TEST_SOURCE_SECRET = 'SCKSUCB5MRRIVQUWM5EFVWDWJAGAMXLP5Y4HL5VMX7KQJGS42OOU73C5'
const TEST_SOURCE_PUBLIC_KEY = 'GCVEVGZLNDWWIPMM3B4Q76ZPSZOCDXTMMG2MLZMJBQURLNSB7NRU4PTB'

process.env.STELLAR_HORIZON_URL = 'https://horizon-testnet.stellar.org'
process.env.STELLAR_SOURCE_SECRET_KEY = TEST_SOURCE_SECRET
process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet'

describe('API Routes - Mock Centralization (Issue #14)', () => {
  describe('GET /api/wallet/balances', () => {
    it('should return 200 with mock balances from fixtures', async () => {
      const response = await balancesGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(3)
      expect(data[0]).toHaveProperty('asset')
      expect(data[0]).toHaveProperty('amount')
      expect(data[0]).toHaveProperty('priceUsd')
    })

    it('should match fixture data', async () => {
      const response = await balancesGET()
      const data = await response.json()

      const fixtures = FixtureFactory.getBalances()
      expect(data).toEqual(fixtures)
    })

    it('should include XLM, USDC, and USDT', async () => {
      const response = await balancesGET()
      const data = await response.json()

      const assets = data.map((b: any) => b.asset)
      expect(assets).toContain('XLM')
      expect(assets).toContain('USDC')
      expect(assets).toContain('USDT')
    })
  })

  describe('GET /api/wallet/transactions', () => {
    it('should return 200 with mock transactions from fixtures', async () => {
      const response = await transactionsGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(4)
    })

    it('should match fixture data', async () => {
      const response = await transactionsGET()
      const data = await response.json()

      const fixtures = FixtureFactory.getTransactions()
      expect(data).toEqual(fixtures)
    })

    it('should include all required fields', async () => {
      const response = await transactionsGET()
      const data = await response.json()

      for (const tx of data) {
        expect(tx).toHaveProperty('id')
        expect(tx).toHaveProperty('type')
        expect(tx).toHaveProperty('amount')
        expect(tx).toHaveProperty('asset')
        expect(tx).toHaveProperty('status')
      }
    })
  })

  describe('POST /api/wallet/send', () => {
    const validBody = {
      destination: 'GBID26P7CMFHLDFV35TT5RKQHTA6QARBYCBCNW2QIXVPMKE6MSE3FCDV',
      amount: 100,
      asset: 'XLM',
      memo: 'test',
    }

    beforeEach(() => {
      jest.clearAllMocks()
      mockLoadAccount.mockResolvedValue(new StellarSdk.Account(TEST_SOURCE_PUBLIC_KEY, '1'))
      mockSubmitTransaction.mockResolvedValue({ hash: 'c'.repeat(64), ledger: 42, successful: true })
    })

    it('should return 200 for valid payload', async () => {
      const req = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },

        body: JSON.stringify(validBody),
      })
      const response = await sendPOST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.hash).toBeDefined()
      // Real Stellar tx hash format — 64 lowercase hex chars — not the old
      // fabricated `0x${Math.random()...}` shape (Issue #63).
      expect(data.hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should return 422 for empty destination', async () => {
      const req = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },

        body: JSON.stringify({ ...validBody, destination: '' }),
      })
      const response = await sendPOST(req)
      expect(response.status).toBe(422)
    })

    it('should return 422 for negative amount', async () => {
      const req = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },

        body: JSON.stringify({ ...validBody, amount: -100 }),
      })
      const response = await sendPOST(req)
      expect(response.status).toBe(422)
    })

    it('should return 400 for invalid JSON', async () => {
      const req = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },

        body: 'not json',
      })
      const response = await sendPOST(req)
      expect(response.status).toBe(400)
    })

    it('should return 422 for invalid Stellar address', async () => {
      const req = new NextRequest('http://localhost/api/wallet/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },

        body: JSON.stringify({ ...validBody, destination: 'invalid' }),
      })
      const response = await sendPOST(req)
      expect(response.status).toBe(422)
    })
  })

  describe('GET /api/rates', () => {
    it('should return 200 with mock rates from fixtures', async () => {
      const response = await ratesGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('rates')
      expect(data).toHaveProperty('updatedAt')
      expect(data.rates).toHaveProperty('XLM_USD')
      expect(data.rates.XLM_USD).toBe(0.1185)
    })

    it('should match fixture data', async () => {
      const response = await ratesGET()
      const data = await response.json()

      const fixtures = FixtureFactory.getSimpleRates()
      expect(data.rates).toEqual(fixtures)
    })

    it('should have an ISO timestamp', async () => {
      const response = await ratesGET()
      const data = await response.json()

      expect(data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })
})
