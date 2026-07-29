import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CryptoConverter } from '../../components/finance/CryptoConverter'
import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../lib/services/container'
import React from 'react'

const mockAssetService = {
  getAssets: jest.fn().mockReturnValue([
    { code: 'XLM', name: 'Stellar Lumens', balance: 1000, priceUsd: 0.10, change24h: 5.0, changePct: 5.0, color: 'bg-blue-500' },
  ]),
  getAssetPrice: jest.fn().mockResolvedValue(0.10),
  convertAsset: jest.fn().mockResolvedValue(98),
  formatAsset: jest.fn((amount: number, code: string) => `${amount} ${code}`),
}

const mockPricing = {
  getAssets: jest.fn().mockReturnValue([]),
  getPrice: jest.fn().mockResolvedValue(0.1),
  formatAsset: jest.fn((amount: number, code: string) => `${amount} ${code}`),
}

const mockFiat = {
  getWallets: jest.fn().mockReturnValue([]),
  formatMoney: jest.fn().mockReturnValue('$100'),
  convertCurrency: jest.fn().mockReturnValue(100),
  getAccountBalance: jest.fn().mockReturnValue(1000),
}

const mockServices = new FinanceServiceContainer(
  undefined,
  undefined,
  mockPricing as any,
  mockFiat as any,
  undefined,
  mockAssetService as any,
  undefined,
)

const renderWithServices = (component: React.ReactNode) => {
  return render(
    <FinanceServicesProvider services={mockServices}>
      {component}
    </FinanceServicesProvider>,
  )
}

describe('CryptoConverter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render converter form', () => {
    renderWithServices(<CryptoConverter />)

    expect(screen.getByTestId('crypto-converter')).toBeInTheDocument()
    expect(screen.getByText('Crypto Converter')).toBeInTheDocument()
    expect(screen.getByTestId('amount-input')).toBeInTheDocument()
    expect(screen.getByTestId('from-asset-select')).toBeInTheDocument()
    expect(screen.getByTestId('to-asset-select')).toBeInTheDocument()
    expect(screen.getByTestId('convert-button')).toBeInTheDocument()
  })

  it('should handle amount input', async () => {
    const user = userEvent.setup({ delay: null })
    renderWithServices(<CryptoConverter />)

    const amountInput = screen.getByTestId('amount-input')
    await user.type(amountInput, '100')

    expect(amountInput).toHaveValue(100)
  })

  it('should swap assets when swap button is clicked', async () => {
    const user = userEvent.setup({ delay: null })
    renderWithServices(<CryptoConverter />)

    const swapButton = screen.getByTestId('swap-button')
    await user.click(swapButton)
    expect(swapButton).toBeInTheDocument()
  })

  it('should perform conversion', async () => {
    const user = userEvent.setup({ delay: null })
    mockAssetService.convertAsset.mockResolvedValue(98)
    renderWithServices(<CryptoConverter />)

    const amountInput = screen.getByTestId('amount-input')
    const convertButton = screen.getByTestId('convert-button')

    await user.type(amountInput, '100')
    await user.click(convertButton)

    await waitFor(() => {
      expect(mockAssetService.convertAsset).toHaveBeenCalledWith('XLM', 'USDC', 100)
    })

    await waitFor(() => {
      expect(screen.getByTestId('conversion-result')).toBeInTheDocument()
    })
  })

  it('should disable convert button when invalid input', () => {
    renderWithServices(<CryptoConverter />)

    const convertButton = screen.getByTestId('convert-button')
    expect(convertButton).toBeDisabled()
  })

  it('should have proper accessibility attributes', () => {
    renderWithServices(<CryptoConverter />)
    expect(screen.getByLabelText('Swap assets')).toBeInTheDocument()
  })
})
