import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransactionList } from '../../components/app/transaction-list'
import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../lib/services/container'
import { FixtureFactory } from '../../lib/fixtures'
import type { IWalletService, IFiatService } from '../../lib/types'

const mockTransactions = jest.fn().mockResolvedValue(FixtureFactory.getTransactionsCompact())

const mockWallet: Partial<IWalletService> = {
  getAccountInfo: jest.fn().mockReturnValue(FixtureFactory.getStellarAccount()),
  getBalance: jest.fn().mockResolvedValue(FixtureFactory.getBalances()),
  getTransactionHistory: mockTransactions,
  validateAddress: jest.fn().mockReturnValue(true),
  generateReceiveAddress: jest.fn().mockReturnValue(FixtureFactory.getTestStellarAddress()),
  shortenKey: jest.fn().mockReturnValue('GAAAAA…AAAWHF'),
  sendPayment: jest.fn().mockResolvedValue({ success: true, hash: '0xabc', status: 'completed' }),
}

const mockFiat: Partial<IFiatService> = {
  getWallets: jest.fn().mockReturnValue(FixtureFactory.getWallets()),
  formatMoney: jest.fn().mockImplementation((amount: number) => `$${amount.toLocaleString()}`),
  convertCurrency: jest.fn().mockReturnValue(1500),
  getAccountBalance: jest.fn().mockReturnValue(10000),
}

const mockServices = new FinanceServiceContainer(
  mockWallet as any,
  undefined,
  undefined,
  mockFiat as any,
  undefined,
  undefined,
  undefined,
)

const renderTransactionList = () => {
  return render(
    <FinanceServicesProvider services={mockServices}>
      <TransactionList />
    </FinanceServicesProvider>,
  )
}

describe('TransactionList (Issue #14)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render loading skeleton initially', () => {
    renderTransactionList()
    expect(screen.getByTestId('transaction-list-loading')).toBeInTheDocument()
    expect(screen.getByTestId('transaction-list-loading')).toHaveAttribute('aria-busy', 'true')
  })

  it('should render transactions after loading', async () => {
    renderTransactionList()

    await waitFor(() => {
      expect(screen.getByTestId('transaction-list')).toBeInTheDocument()
    })

    expect(screen.getByTestId('transaction-t1')).toBeInTheDocument()
    expect(screen.getByTestId('transaction-t2')).toBeInTheDocument()
    expect(screen.getByText('Received XLM')).toBeInTheDocument()
    expect(screen.getByText('Sent XLM')).toBeInTheDocument()
  })

  it('should show empty state when no transactions exist', async () => {
    mockTransactions.mockResolvedValueOnce([])
    renderTransactionList()

    await waitFor(() => {
      expect(screen.getByTestId('transaction-list-empty')).toBeInTheDocument()
    })

    expect(screen.getByText('No transactions yet')).toBeInTheDocument()
  })

  it('should respect the limit prop', async () => {
    render(
      <FinanceServicesProvider services={mockServices}>
        <TransactionList limit={1} />
      </FinanceServicesProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('transaction-t1')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('transaction-t2')).not.toBeInTheDocument()
  })

  it('should handle fetch error gracefully', async () => {
    mockTransactions.mockRejectedValueOnce(new Error('Network error'))
    renderTransactionList()

    await waitFor(() => {
      expect(screen.getByTestId('transaction-list-empty')).toBeInTheDocument()
    })
  })

  it('should have accessible list semantics', async () => {
    renderTransactionList()

    await waitFor(() => {
      expect(screen.getByRole('list')).toBeInTheDocument()
    })

    const items = screen.getAllByRole('listitem')
    expect(items.length).toBeGreaterThan(0)
  })
})
