/**
 * @jest-environment node
 */

// Hoisted mock fns (jest allows referencing identifiers prefixed with
// `mock` from inside a jest.mock() factory despite hoisting).
const mockLoadAccount = jest.fn()
const mockSubmitTransaction = jest.fn()
const mockSign = jest.fn()

const FAKE_TX_HASH_BYTES = Buffer.from('11'.repeat(32), 'hex')

jest.mock('@stellar/stellar-sdk', () => {
  class MockAsset {
    code: string
    issuer: string
    constructor(code: string, issuer: string) {
      this.code = code
      this.issuer = issuer
    }
    static native() {
      return { code: 'XLM', issuer: 'native' }
    }
  }

  class MockTransaction {
    sign(...args: unknown[]) {
      mockSign(...args)
    }
    hash() {
      return FAKE_TX_HASH_BYTES
    }
  }

  class MockTransactionBuilder {
    constructor(_account: unknown, _opts: unknown) {
      void _account
      void _opts
    }
    addOperation() {
      return this
    }
    addMemo() {
      return this
    }
    setTimeout() {
      return this
    }
    build() {
      return new MockTransaction()
    }
  }

  class MockServer {
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

  return {
    Networks: {
      TESTNET: 'Test SDF Network ; September 2015',
      PUBLIC: 'Public Global Stellar Network ; September 2015',
    },
    Asset: MockAsset,
    Keypair: {
      fromSecret: (secret: string) => ({
        publicKey: () => 'GSIGNERPUBLICKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        secret: () => secret,
      }),
    },
    Memo: { text: (value: string) => ({ type: 'text', value }) },
    BASE_FEE: '100',
    Operation: { payment: (params: unknown) => ({ type: 'payment', ...(params as object) }) },
    TransactionBuilder: MockTransactionBuilder,
    Horizon: { Server: MockServer },
  }
})

import {
  StellarPaymentConfigError,
  StellarPaymentService,
} from '../../../lib/services/stellar-payment.service'

const VALID_CONFIG_ENV = {
  STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
  STELLAR_SOURCE_SECRET_KEY: 'SFAKESOURCESECRETKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  NEXT_PUBLIC_STELLAR_NETWORK: 'testnet',
}

const DESTINATION = 'GDXQVDVXHPB7YIQTHDXTP3HXNJCX3IJ7DHQPB7Y6JDBYVFYVLXFPYCPX'

describe('StellarPaymentService', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, ...VALID_CONFIG_ENV }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('configuration', () => {
    it('throws StellarPaymentConfigError when STELLAR_SOURCE_SECRET_KEY is missing', async () => {
      process.env.STELLAR_SOURCE_SECRET_KEY = ''
      const service = new StellarPaymentService()

      await expect(
        service.submitPayment({ destination: DESTINATION, amount: 10, asset: 'XLM' }),
      ).rejects.toThrow(StellarPaymentConfigError)
    })

    it('getSigningPublicKey returns null when unconfigured', () => {
      process.env.STELLAR_SOURCE_SECRET_KEY = ''
      expect(new StellarPaymentService().getSigningPublicKey()).toBeNull()
    })

    it('getSigningPublicKey returns the signer public key when configured', () => {
      const service = new StellarPaymentService()
      expect(service.getSigningPublicKey()).toBe(
        'GSIGNERPUBLICKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      )
    })
  })

  describe('submitPayment — success', () => {
    it('returns status completed with the real Horizon hash on a successful submission', async () => {
      mockLoadAccount.mockResolvedValue({ accountId: () => 'G...' })
      mockSubmitTransaction.mockResolvedValue({
        hash: 'a'.repeat(64),
        ledger: 12345,
        successful: true,
      })

      const service = new StellarPaymentService()
      const result = await service.submitPayment({ destination: DESTINATION, amount: 10, asset: 'XLM' })

      expect(result.status).toBe('completed')
      expect(result.hash).toBe('a'.repeat(64))
      expect(result.ledger).toBe(12345)
      expect(mockSign).toHaveBeenCalled()
    })

    it('always produces a real 64-char lowercase hex tx hash, not a fabricated one', async () => {
      mockLoadAccount.mockResolvedValue({})
      mockSubmitTransaction.mockResolvedValue({ hash: undefined, successful: true })

      const service = new StellarPaymentService()
      const result = await service.submitPayment({ destination: DESTINATION, amount: 1, asset: 'XLM' })

      expect(result.hash).toMatch(/^[0-9a-f]{64}$/)
      expect(result.hash).not.toMatch(/^0x/)
    })
  })

  describe('submitPayment — definitive ledger rejection', () => {
    it('maps a Horizon result_codes rejection to status failed, keeping the real hash', async () => {
      mockLoadAccount.mockResolvedValue({})
      const horizonError = new Error('Request failed with status code 400')
      ;(horizonError as any).response = {
        status: 400,
        data: { extras: { result_codes: { transaction: 'tx_failed', operations: ['op_underfunded'] } } },
      }
      mockSubmitTransaction.mockRejectedValue(horizonError)

      const service = new StellarPaymentService()
      const result = await service.submitPayment({ destination: DESTINATION, amount: 5, asset: 'XLM' })

      expect(result.status).toBe('failed')
      expect(result.error).toContain('op_underfunded')
      expect(result.hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('maps a missing/unfunded source account to status failed without attempting submission', async () => {
      const notFound = new Error('Not Found')
      ;(notFound as any).response = { status: 404 }
      mockLoadAccount.mockRejectedValue(notFound)

      const service = new StellarPaymentService()
      const result = await service.submitPayment({ destination: DESTINATION, amount: 5, asset: 'XLM' })

      expect(result.status).toBe('failed')
      expect(result.error).toMatch(/not funded|does not exist/i)
      expect(mockSubmitTransaction).not.toHaveBeenCalled()
    })
  })

  describe('submitPayment — ambiguous outcome', () => {
    it('maps a response-less network error (timeout) to status pending, not failed', async () => {
      mockLoadAccount.mockResolvedValue({})
      mockSubmitTransaction.mockRejectedValue(new Error('timeout of 60000ms exceeded'))

      const service = new StellarPaymentService()
      const result = await service.submitPayment({ destination: DESTINATION, amount: 5, asset: 'XLM' })

      expect(result.status).toBe('pending')
      expect(result.hash).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe('asset resolution', () => {
    it('rejects an asset code with no known issuer', async () => {
      mockLoadAccount.mockResolvedValue({})
      const service = new StellarPaymentService()

      await expect(
        service.submitPayment({ destination: DESTINATION, amount: 5, asset: 'DOGE' }),
      ).rejects.toThrow(/unsupported/i)
    })
  })
})
