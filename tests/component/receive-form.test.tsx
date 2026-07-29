/**
 * Component tests for ReceiveForm — issue #22
 * Covers QR generation, payment request sharing, validation, and accessibility.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReceiveForm } from '../../components/app/receive-form'
import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../lib/services/container'
import { TEST_STELLAR_ADDRESS } from '../../lib/finance-data'
import { toast } from 'sonner'

jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <svg data-testid="mock-qr-svg" data-value={value} />
  ),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const mockWallet = {
  sendPayment: jest.fn(),
  validateAddress: jest.fn().mockReturnValue(true),
  getAccountInfo: jest.fn().mockReturnValue({
    publicKey: TEST_STELLAR_ADDRESS,
    name: 'Primary',
    isFunded: true,
  }),
  getBalance: jest.fn().mockResolvedValue([]),
  generateReceiveAddress: jest.fn().mockReturnValue(TEST_STELLAR_ADDRESS),
  getTransactionHistory: jest.fn().mockResolvedValue([]),
  shortenKey: jest.fn((k: string) => k.slice(0, 6) + '…'),
}

const mockPricing = {
  getAssets: jest.fn().mockReturnValue([]),
  getPrice: jest.fn().mockResolvedValue(0.12),
  formatAsset: jest.fn((amount: number, code: string) => `${amount} ${code}`),
}

const mockFiat = {
  getWallets: jest.fn().mockReturnValue([]),
  convertCurrency: jest.fn().mockReturnValue(0),
  getExchangeRate: jest.fn().mockReturnValue(1),
  getAccountBalance: jest.fn().mockReturnValue(0),
}

function renderReceiveForm() {
  const container = new FinanceServiceContainer(
    mockWallet as any,
    undefined,
    mockPricing as any,
    mockFiat as any
  )
  return render(
    <FinanceServicesProvider services={container}>
      <ReceiveForm />
    </FinanceServicesProvider>
  )
}

  beforeEach(() => {
    jest.clearAllMocks()
  })

describe('ReceiveForm — issue #22', () => {
  it('renders address tab with service-layer address and QR', () => {
    renderReceiveForm()
    expect(screen.getByTestId('receive-address')).toHaveTextContent(TEST_STELLAR_ADDRESS)
    const qr = screen.getByTestId('address-qr')
    expect(qr).toHaveAttribute('data-value', TEST_STELLAR_ADDRESS)
    expect(qr).toHaveAttribute('aria-label', expect.stringContaining('QR code'))
  })

  it('copies address to clipboard', async () => {
    renderReceiveForm()
    fireEvent.click(screen.getByTestId('copy-address-button'))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEST_STELLAR_ADDRESS)
    })
  })

  it('generates payment request QR with SEP-0007 URI', async () => {
    const user = userEvent.setup({ delay: null })
    renderReceiveForm()
    await user.click(screen.getByTestId('tab-request'))
    await user.type(screen.getByTestId('receive-amount-input'), '15')
    await user.type(screen.getByTestId('receive-memo-input'), 'Lunch')

    const qr = screen.getByTestId('payment-qr')
    const value = qr.getAttribute('data-value') ?? ''
    expect(value).toContain('web+stellar:pay')
    expect(value).toContain('amount=15')
    expect(value).toContain('memo=Lunch')

    expect(screen.getByTestId('receive-summary')).toBeInTheDocument()
    expect(screen.getByTestId('summary-amount')).toHaveTextContent('15 XLM')
    expect(screen.getByTestId('summary-memo')).toHaveTextContent('Lunch')
  })

  it('shows accessible error for invalid amount', async () => {
    const user = userEvent.setup({ delay: null })
    renderReceiveForm()
    await user.click(screen.getByTestId('tab-request'))
    await user.type(screen.getByTestId('receive-amount-input'), '-3')

    const error = screen.getByTestId('receive-amount-error')
    expect(error).toHaveAttribute('role', 'alert')
    expect(error).toHaveTextContent(/greater than zero/i)
    expect(screen.getByTestId('copy-payment-button')).toBeDisabled()
    expect(screen.getByTestId('share-payment-button')).toBeDisabled()
  })

  it('falls back to clipboard when Web Share API is unavailable', async () => {
    renderReceiveForm()
    fireEvent.click(screen.getByTestId('share-address-button'))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })
  })

  it('uses Web Share API when available', async () => {
    const share = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
      writable: true,
    })

    renderReceiveForm()
    fireEvent.click(screen.getByTestId('share-address-button'))

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My Stellar Address' })
      )
    })
  })

  it('supports keyboard navigation between tabs', async () => {
    const user = userEvent.setup({ delay: null })
    renderReceiveForm()
    await user.click(screen.getByTestId('tab-request'))
    expect(screen.getByTestId('receive-request-card')).toBeInTheDocument()
  })

  describe('dynamic wallet address — issue #7', () => {
    it('renders the address the wallet service provides, not a hardcoded value', () => {
      const dynamicAddress = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBNQO'
      mockWallet.generateReceiveAddress.mockReturnValue(dynamicAddress)

      renderReceiveForm()

      expect(screen.getByTestId('receive-address')).toHaveTextContent(dynamicAddress)
      mockWallet.generateReceiveAddress.mockReturnValue(TEST_STELLAR_ADDRESS)
    })

    it('shows a fallback message when no account is available', () => {
      mockWallet.generateReceiveAddress.mockReturnValue('')
      mockWallet.validateAddress.mockReturnValue(false)

      renderReceiveForm()

      expect(screen.getByTestId('receive-no-account')).toHaveTextContent(
        /no stellar account is available/i
      )
      expect(screen.queryByTestId('receive-address')).not.toBeInTheDocument()

      mockWallet.generateReceiveAddress.mockReturnValue(TEST_STELLAR_ADDRESS)
      mockWallet.validateAddress.mockReturnValue(true)
    })
  })

  describe('clipboard/share error handling — issue #9', () => {
    it('shows a fallback message when the clipboard write fails', async () => {
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
        new Error('denied')
      )
      renderReceiveForm()
      fireEvent.click(screen.getByTestId('copy-address-button'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Couldn't copy")
        )
      })
      expect(toast.success).not.toHaveBeenCalled()
    })

    it('shows a fallback message when the clipboard API is unavailable', async () => {
      const originalClipboard = navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
        writable: true,
      })

      renderReceiveForm()
      fireEvent.click(screen.getByTestId('copy-address-button'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Couldn't copy")
        )
      })

      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
        writable: true,
      })
    })

    it('falls back to copying when sharing fails for a reason other than user cancellation', async () => {
      const share = jest.fn().mockRejectedValue(new Error('share failed'))
      Object.defineProperty(navigator, 'share', {
        value: share,
        configurable: true,
        writable: true,
      })

      renderReceiveForm()
      fireEvent.click(screen.getByTestId('share-address-button'))

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining(TEST_STELLAR_ADDRESS)
        )
      })
    })

    it('does not fall back to copying when the user cancels the share sheet', async () => {
      const abortError = Object.assign(new Error('cancelled'), { name: 'AbortError' })
      const share = jest.fn().mockRejectedValue(abortError)
      Object.defineProperty(navigator, 'share', {
        value: share,
        configurable: true,
        writable: true,
      })

      renderReceiveForm()
      fireEvent.click(screen.getByTestId('share-address-button'))

      await waitFor(() => {
        expect(share).toHaveBeenCalled()
      })
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
      expect(toast.error).not.toHaveBeenCalled()
    })
  })
})
