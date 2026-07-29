import { render, screen } from '@testing-library/react'
import { BalanceCard } from '../../components/app/balance-card'
import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { ActiveAccountProvider } from '../../hooks/useActiveAccount'
import { FinanceServiceContainer } from '../../lib/services/container'
import React from 'react'

const mockPricing = {
  getAssets: jest.fn().mockReturnValue([
    { code: 'XLM', name: 'Stellar Lumens', balance: 4250.5, priceUsd: 0.1185, change24h: 4.7, changePct: 4.7, color: 'bg-foreground' },
  ]),
  getPrice: jest.fn().mockResolvedValue(0.1185),
  formatAsset: jest.fn().mockReturnValue('4,250.5000 XLM'),
}

const mockFiat = {
  getWallets: jest.fn().mockReturnValue([
    { id: 'w1', code: 'NGN', name: 'Nigerian Naira', label: 'NGN', balance: 1284500.75, color: 'bg-green-500', changePct: 2.4 },
  ]),
  formatMoney: jest.fn().mockReturnValue('$1,284,500.75'),
  convertCurrency: jest.fn().mockReturnValue(500),
  getAccountBalance: jest.fn().mockReturnValue(10000),
}

const renderBalanceCard = () => {
  const services = new FinanceServiceContainer(
    undefined,
    undefined,
    mockPricing as any,
    mockFiat as any,
  )
  return render(
    <FinanceServicesProvider services={services}>
      <ActiveAccountProvider>
        <BalanceCard />
      </ActiveAccountProvider>
    </FinanceServicesProvider>,
  )
}

describe('BalanceCard (Issue #14)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render the card container', () => {
    renderBalanceCard()
    expect(screen.getByTestId('balance-card')).toBeInTheDocument()
  })

  it('should render loading state initially', () => {
    renderBalanceCard()
    expect(screen.getByTestId('balance-card-loading')).toBeInTheDocument()
  })

  it('should eventually load balance data', async () => {
    renderBalanceCard()

    const card = await screen.findByTestId('balance-card', {}, { timeout: 5000 })
    expect(card).toBeInTheDocument()
    expect(mockFiat.getWallets).toHaveBeenCalled()
    
    // Verify accessibility requirements for async balance updates (Issue #88)
    const balanceValue = screen.getByTestId('total-value')
    expect(balanceValue).toHaveAttribute('aria-live', 'polite')
    expect(balanceValue).toHaveAttribute('aria-atomic', 'true')
    
    const balanceChange = screen.getByTestId('balance-change')
    expect(balanceChange).toHaveAttribute('aria-live', 'polite')
    expect(balanceChange).toHaveAttribute('aria-atomic', 'true')
  })

  it('should render the account switcher', () => {
    renderBalanceCard()
    expect(screen.getByTestId('account-switcher')).toBeInTheDocument()
  })
})
