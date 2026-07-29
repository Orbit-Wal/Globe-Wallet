/**
 * Unit tests — EvmService (multi-chain: Base + Ethereum)
 *
 * getBalances is exercised against a mocked viem public client (no real
 * network I/O in unit tests); validateAddress/getSupportedChains/shortenKey
 * exercise the real viem address utilities. See tests/integration for the
 * route-level contract and a fork prompt's earlier session for live testnet
 * verification (real Base Sepolia / Ethereum Sepolia balances fetched
 * end-to-end during development).
 */

const mockGetBalance = jest.fn()
const mockReadContract = jest.fn()

jest.mock('viem', () => {
  const actual = jest.requireActual('viem')
  return {
    ...actual,
    createPublicClient: jest.fn(() => ({
      getBalance: mockGetBalance,
      readContract: mockReadContract,
    })),
  }
})

import { EvmService } from '../../../lib/evm/evm.service'
import { EvmServiceError } from '../../../lib/types'

describe('EvmService', () => {
  let service: EvmService

  beforeEach(() => {
    service = new EvmService()
    mockGetBalance.mockReset()
    mockReadContract.mockReset()
  })

  describe('validateAddress', () => {
    it('accepts a correctly checksummed address', () => {
      expect(service.validateAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true)
    })

    it('accepts an all-lowercase address (checksum-agnostic)', () => {
      expect(service.validateAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(true)
    })

    it('rejects a Stellar-shaped address', () => {
      expect(service.validateAddress('GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX')).toBe(false)
    })

    it('rejects an address that is too short', () => {
      expect(service.validateAddress('0xd8dA6BF26964aF9D7eEd9e')).toBe(false)
    })

    it('rejects a non-hex string', () => {
      expect(service.validateAddress('0xnothexatall000000000000000000000000000')).toBe(false)
    })

    it('rejects empty/garbage input', () => {
      expect(service.validateAddress('')).toBe(false)
      expect(service.validateAddress('not an address')).toBe(false)
    })
  })

  describe('getSupportedChains / getNetwork', () => {
    it('lists both Base and Ethereum', () => {
      const chains = service.getSupportedChains().map((c) => c.chainId)
      expect(chains).toEqual(expect.arrayContaining(['base', 'ethereum']))
      expect(chains).toHaveLength(2)
    })

    it('getNetwork returns the matching config', () => {
      expect(service.getNetwork('base').name).toBe('Base Sepolia')
      expect(service.getNetwork('ethereum').name).toBe('Ethereum Sepolia')
    })
  })

  describe('shortenKey', () => {
    it('shortens with EVM-appropriate default lead/tail', () => {
      expect(service.shortenKey('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe('0xd8dA…6045')
    })
  })

  describe('getBalances', () => {
    const ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

    it('throws EvmServiceError for an invalid address without calling the RPC', async () => {
      await expect(service.getBalances('base', 'not-an-address')).rejects.toThrow(EvmServiceError)
      expect(mockGetBalance).not.toHaveBeenCalled()
    })

    it('returns native + USDC balances scaled by decimals', async () => {
      mockGetBalance.mockResolvedValue(BigInt('5557583851392472361')) // 18 decimals
      mockReadContract.mockResolvedValue(BigInt('491099606')) // 6 decimals

      const balances = await service.getBalances('base', ADDRESS)

      expect(balances).toEqual([
        { symbol: 'ETH', amount: 5.557583851392472, raw: '5557583851392472361', decimals: 18 },
        { symbol: 'USDC', amount: 491.099606, raw: '491099606', decimals: 6 },
      ])
    })

    it('wraps RPC failures in EvmServiceError with a descriptive message', async () => {
      mockGetBalance.mockRejectedValue(new Error('RPC timeout'))

      await expect(service.getBalances('ethereum', ADDRESS)).rejects.toThrow(
        /Failed to fetch Ethereum Sepolia balances: RPC timeout/,
      )
    })
  })
})
