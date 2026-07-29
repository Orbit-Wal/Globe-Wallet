/**
 * @jest-environment node
 *
 * EVM_SOURCE_PRIVATE_KEY is set at module-load time, before any imports run,
 * so EvmPaymentService's lazily-constructed singleton picks it up once for
 * this whole file — same reasoning as fixture-integration.test.ts for
 * STELLAR_SOURCE_SECRET_KEY. The "not configured" 503 case needs the
 * opposite state and lives in its own file (evm-send-unconfigured.test.ts)
 * so it gets a fresh module registry instead of fighting this file's cached
 * singleton.
 */

process.env.EVM_SOURCE_PRIVATE_KEY = `0x${'1'.repeat(64)}`

const mockGetBalance = jest.fn()
const mockReadContract = jest.fn()
const mockSendTransaction = jest.fn()
const mockWaitForTransactionReceipt = jest.fn()

jest.mock('viem', () => {
  const actual = jest.requireActual('viem')
  return {
    ...actual,
    createPublicClient: jest.fn(() => ({
      getBalance: mockGetBalance,
      readContract: mockReadContract,
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    })),
    createWalletClient: jest.fn(() => ({
      account: { address: '0x1111111111111111111111111111111111111e' },
      sendTransaction: mockSendTransaction,
    })),
  }
})

import { NextRequest } from 'next/server'
import { GET as balanceGET } from '../../app/api/evm/balance/route'
import { POST as sendPOST } from '../../app/api/evm/send/route'

const VALID_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

describe('EVM API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/evm/balance', () => {
    it('returns 422 for an unsupported chain', async () => {
      const req = new NextRequest(`http://localhost/api/evm/balance?chainId=solana&address=${VALID_ADDRESS}`)
      const response = await balanceGET(req)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toMatch(/ERR_UNSUPPORTED_CHAIN/)
    })

    it('returns 422 for an invalid address', async () => {
      const req = new NextRequest('http://localhost/api/evm/balance?chainId=base&address=not-an-address')
      const response = await balanceGET(req)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toMatch(/ERR_INVALID_ADDRESS/)
    })

    it('returns native + token balances for a valid request', async () => {
      mockGetBalance.mockResolvedValue(BigInt('1000000000000000000'))
      mockReadContract.mockResolvedValue(BigInt('2500000'))

      const req = new NextRequest(`http://localhost/api/evm/balance?chainId=base&address=${VALID_ADDRESS}`)
      const response = await balanceGET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.chainId).toBe('base')
      expect(data.balances).toEqual([
        { symbol: 'ETH', amount: 1, raw: '1000000000000000000', decimals: 18 },
        { symbol: 'USDC', amount: 2.5, raw: '2500000', decimals: 6 },
      ])
    })

    it('returns 502 when the RPC call fails', async () => {
      mockGetBalance.mockRejectedValue(new Error('RPC unreachable'))

      const req = new NextRequest(`http://localhost/api/evm/balance?chainId=base&address=${VALID_ADDRESS}`)
      const response = await balanceGET(req)

      expect(response.status).toBe(502)
    })
  })

  describe('POST /api/evm/send', () => {
    function makeRequest(body: unknown, withAuth = true) {
      return new NextRequest('http://localhost/api/evm/send', {
        method: 'POST',
        headers: withAuth ? { Authorization: 'Bearer test-token' } : {},
        body: JSON.stringify(body),
      })
    }

    it('returns 401 without a bearer token', async () => {
      const response = await sendPOST(makeRequest({ chainId: 'base', destination: VALID_ADDRESS, amount: 1 }, false))
      expect(response.status).toBe(401)
    })

    it('returns 422 for an unsupported chain', async () => {
      const response = await sendPOST(makeRequest({ chainId: 'solana', destination: VALID_ADDRESS, amount: 1 }))
      const data = await response.json()
      expect(response.status).toBe(422)
      expect(data.error).toMatch(/ERR_UNSUPPORTED_CHAIN/)
    })

    it('returns 422 for an invalid destination address', async () => {
      const response = await sendPOST(makeRequest({ chainId: 'base', destination: 'not-an-address', amount: 1 }))
      const data = await response.json()
      expect(response.status).toBe(422)
      expect(data.error).toMatch(/ERR_INVALID_ADDRESS/)
    })

    it('returns 422 for a non-positive amount', async () => {
      const response = await sendPOST(makeRequest({ chainId: 'base', destination: VALID_ADDRESS, amount: 0 }))
      const data = await response.json()
      expect(response.status).toBe(422)
      expect(data.error).toMatch(/ERR_INVALID_AMOUNT/)
    })

    it('returns 200 with a real tx hash when the tx confirms', async () => {
      mockSendTransaction.mockResolvedValue('0xabc123')
      mockWaitForTransactionReceipt.mockResolvedValue({ status: 'success' })

      const response = await sendPOST(makeRequest({ chainId: 'base', destination: VALID_ADDRESS, amount: 0.01 }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('completed')
      expect(data.hash).toBe('0xabc123')
    })

    it('reports pending (not failed) when broadcast succeeds but confirmation times out', async () => {
      mockSendTransaction.mockResolvedValue('0xabc123')
      mockWaitForTransactionReceipt.mockRejectedValue(new Error('timeout'))

      const response = await sendPOST(makeRequest({ chainId: 'base', destination: VALID_ADDRESS, amount: 0.01 }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('pending')
      expect(data.hash).toBe('0xabc123')
    })

    it('reports failed when the broadcast itself throws', async () => {
      mockSendTransaction.mockRejectedValue(new Error('insufficient funds'))

      const response = await sendPOST(makeRequest({ chainId: 'base', destination: VALID_ADDRESS, amount: 0.01 }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(false)
      expect(data.status).toBe('failed')
    })
  })
})
