import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BalanceCard } from '../../components/finance/BalanceCard'
import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../lib/services/container'
import React from 'react'

const mockAssetService = {
  getAssets: jest.fn().mockReturnValue([
    { code: 'XLM', name: 'Stellar Lumens', balance: 1000, priceUsd: 0.10, change24h: 5.0, changePct: 5.0, color: 'bg-blue-500' },
  ]),
  getAssetPrice: jest.fn().mockResolvedValue(0.10),
  convertAsset: jest.fn(),
  formatAsset: jest.fn().mockReturnValue('1000.00 XLM'),
}

const mockFiatService = {
  getWallets: jest.fn().mockReturnValue([
    { id: 'w1', code: 'USD', name: 'US Dollar', label: 'US Dollar', symbol: '$', balance: 1000, changePct: 2.0, color: 'bg-blue-500' },
  ]),
  formatMoney: jest.fn().mockReturnValue('$1,000.00'),
  convertCurrency: jest.fn().mockReturnValue(1000),
  getAccountBalance: jest.fn().mockReturnValue(1000),
}

const mockStellarService = {
  getAccountInfo: jest.fn().mockReturnValue({ publicKey: 'GAAAA...WHF', network: 'testnet', isFunded: true, name: 'Test' }),
  generateReceiveAddress: jest.fn().mockReturnValue('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'),
  validateAddress: jest.fn().mockReturnValue(true),
  shortenKey: jest.fn().mockReturnValue('GAAAAA…AAAWHF'),
  getOffRampMethods: jest.fn().mockReturnValue([]),
  getOffRampRate: jest.fn().mockReturnValue(1580.5),
}

const mockPricingService = {
  getAssets: jest.fn().mockReturnValue([
    { code: 'XLM', name: 'Stellar Lumens', balance: 1000, priceUsd: 0.10, change24h: 5.0, changePct: 5.0, color: 'bg-blue-500' },
  ]),
  getPrice: jest.fn().mockResolvedValue(0.10),
  formatAsset: jest.fn().mockReturnValue('1000.00 XLM'),
}

const mockServices = new FinanceServiceContainer(
  undefined,
  undefined,
  mockPricingService as any,
  mockFiatService as any,
  undefined,
  mockAssetService as any,
  mockStellarService as any,
)

const renderWithServices = (component: React.ReactNode) => {
  return render(
    <FinanceServicesProvider services={mockServices}>
      {component}
    </FinanceServicesProvider>,
  )
}

describe('BalanceCard (Legacy Finance)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render loading state', () => {
    renderWithServices(<BalanceCard title="Test Balance" />)
    expect(screen.getByTestId('balance-card-loading')).toBeInTheDocument()
  })

  it('should render balance data after loading', async () => {
    renderWithServices(<BalanceCard title="Test Balance" showTotal />)

    await waitFor(() => {
      expect(screen.getByTestId('balance-card')).toBeInTheDocument()
    })

    expect(screen.getByText('Test Balance')).toBeInTheDocument()
    expect(screen.getByTestId('total-value')).toBeInTheDocument()
  })

  it('should handle refresh button click', async () => {
    const user = userEvent.setup({ delay: null })
    renderWithServices(<BalanceCard title="Test Balance" />)

    await waitFor(() => {
      expect(screen.getByTestId('balance-card')).toBeInTheDocument()
    })

    const refreshButton = screen.getByTestId('refresh-button')
    await user.click(refreshButton)

    expect(mockFiatService.getWallets).toHaveBeenCalledTimes(2)
    expect(mockPricingService.getAssets).toHaveBeenCalledTimes(2)
  })

  it('should render error state and retry button', async () => {
    const errorFiat = {
      ...mockFiatService,
      getWallets: jest.fn().mockImplementation(() => {
        throw new Error('Network error')
      }),
    }

    const errorServices = new FinanceServiceContainer(
      undefined,
      undefined,
      mockPricingService as any,
      errorFiat as any,
      undefined,
      mockAssetService as any,
      mockStellarService as any,
    )

    render(
      <FinanceServicesProvider services={errorServices}>
        <BalanceCard title="Test Balance" />
      </FinanceServicesProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('balance-card-error')).toBeInTheDocument()
    })
  })

  it('should have proper accessibility attributes', async () => {
    renderWithServices(<BalanceCard title="Test Balance" />)

    await waitFor(() => {
      expect(screen.getByTestId('balance-card')).toBeInTheDocument()
    })

    const refreshButton = screen.getByTestId('refresh-button')
    expect(refreshButton).toHaveAttribute('aria-label', 'Refresh balances')
  })
})
