import { render, screen, waitFor } from '@testing-library/react'
import { TransactionList } from '../../components/app/transaction-list'
import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../lib/services/container'
import { Transaction } from '../../lib/types'
import React from 'react'

const mockTransactions: Transaction[] = [
  {
    id: 't1',
    type: 'receive',
    amount: 75000,
    asset: 'XLM',
    address: 'GDXSPAY...',
    date: 'Today, 09:42',
    status: 'completed',
    name: 'Adaeze Okoro',
    detail: 'Transfer from @adaeze',
    category: 'transfer',
    currency: 'NGN',
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
  getAccountBalance: jest.fn().mockReturnValue(0),
  getWallets: jest.fn().mockReturnValue([]),
  formatMoney: jest.fn().mockReturnValue('75,000 NGN'),
  convertCurrency: jest.fn(),
}

const services = new FinanceServiceContainer(
  mockWallet as any,
  undefined,
  undefined,
  mockFiat as any,
)

describe('App TransactionList', () => {
  it('renders transactions from the service layer', async () => {
    render(
      <FinanceServicesProvider services={services}>
        <TransactionList limit={5} />
      </FinanceServicesProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('transaction-list')).toBeInTheDocument()
    })

    expect(screen.getByTestId('transaction-t1')).toBeInTheDocument()
    expect(screen.getByText('Adaeze Okoro')).toBeInTheDocument()
  })

  it('exposes list semantics for accessibility', async () => {
    render(
      <FinanceServicesProvider services={services}>
        <TransactionList limit={5} />
      </FinanceServicesProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('transaction-list')).toBeInTheDocument()
    })

    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
