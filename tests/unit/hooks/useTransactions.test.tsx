import { renderHook, waitFor } from '@testing-library/react'
import { useTransactions } from '../../../hooks/useTransactions'
import { FinanceServicesProvider } from '../../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../../lib/services/container'
import { Transaction } from '../../../lib/types'
import React from 'react'

const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'receive',
    amount: 100,
    asset: 'XLM',
    address: 'G...',
    date: 'Today',
    status: 'completed',
    category: 'transfer',
    currency: 'USD',
  },
  {
    id: '2',
    type: 'send',
    amount: 50,
    asset: 'USDC',
    address: 'G...',
    date: 'Yesterday',
    status: 'completed',
    category: 'bills',
    currency: 'USD',
  },
]

const mockWallet = {
  getTransactionHistory: jest.fn().mockResolvedValue(mockTransactions),
  getAccountInfo: jest.fn(),
  getBalance: jest.fn(),
  sendPayment: jest.fn(),
  generateReceiveAddress: jest.fn(),
  validateAddress: jest.fn(),
  shortenKey: jest.fn(),
}

const mockFiat = {
  getAccountBalance: jest.fn().mockReturnValue(1000),
  getWallets: jest.fn().mockReturnValue([]),
  formatMoney: jest.fn((amount: number) => `$${amount}`),
  convertCurrency: jest.fn().mockReturnValue(100),
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FinanceServicesProvider
    services={
      new FinanceServiceContainer(
        mockWallet as any,
        undefined,
        undefined,
        mockFiat as any,
      )
    }
  >
    {children}
  </FinanceServicesProvider>
)

describe('useTransactions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads and filters transactions by direction', async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper })

    await waitFor(async () => {
      const incoming = await result.current.getTransactions({ type: 'in' })
      expect(incoming).toHaveLength(1)
      expect(incoming[0].type).toBe('receive')
    })
  })

  it('formats transaction amounts via fiat service', async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper })

    await waitFor(async () => {
      const txs = await result.current.getTransactions()
      const formatted = result.current.formatTransactionAmount(txs[0])
      expect(formatted).toBe('$100')
      expect(mockFiat.formatMoney).toHaveBeenCalled()
    })
  })

  it('calculates category totals with sign by direction', async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper })

    await waitFor(async () => {
      const total = await result.current.calculateCategoryTotal('transfer', 'USD')
      expect(total).toBe(100)
    })
  })
})
