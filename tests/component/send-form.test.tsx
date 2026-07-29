import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SendForm } from '../../components/app/send-form'
import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../lib/services/container'
import React from 'react'

const VALID_ADDRESS = 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX'

async function submitSendForm() {
  fireEvent.click(screen.getByTestId('review-button'))
  await waitFor(() => {
    expect(screen.getByTestId('confirm-send-button')).toBeInTheDocument()
  })
  fireEvent.click(screen.getByTestId('confirm-send-button'))
}

describe('SendForm Component (Issue #14)', () => {
  let mockWallet: any
  let mockPricing: any
  let mockFiat: any

  beforeEach(() => {
    mockWallet = {
      sendPayment: jest.fn().mockResolvedValue({ success: true, hash: '0xhash123', status: 'completed' }),
      validateAddress: jest.fn().mockReturnValue(true),
      getAccountInfo: jest.fn().mockReturnValue({ publicKey: VALID_ADDRESS, network: 'Stellar Public Network', isFunded: true }),
      getBalance: jest.fn().mockResolvedValue([{ asset: 'XLM', amount: 1000, priceUsd: 0.12 }]),
      getTransactionHistory: jest.fn().mockResolvedValue([]),
      generateReceiveAddress: jest.fn().mockReturnValue(VALID_ADDRESS),
      shortenKey: jest.fn().mockReturnValue('GDXSPA…6BNRX'),
    }

    mockPricing = {
      getAssets: jest.fn().mockReturnValue([
        { code: 'XLM', name: 'Stellar Lumens', balance: 1000, priceUsd: 0.12, change24h: 1.5, color: 'bg-primary' },
        { code: 'USDC', name: 'USD Coin', balance: 500, priceUsd: 1.0, change24h: 0, color: 'bg-blue-500' },
      ]),
      getPrice: jest.fn().mockResolvedValue(0.12),
      formatAsset: jest.fn().mockImplementation((amount: number, code: string) => `${amount} ${code}`),
    }

    mockFiat = {
      getWallets: jest.fn().mockReturnValue([
        { id: 'w1', code: 'USD', name: 'US Dollar', label: 'USD', balance: 1000, color: 'bg-blue-500' },
      ]),
      formatMoney: jest.fn().mockImplementation((amount: number) => `$${amount.toLocaleString()}`),
      convertCurrency: jest.fn().mockReturnValue(1000),
      getAccountBalance: jest.fn().mockReturnValue(1000),
    }
  })

  function renderSendForm() {
    const container = new FinanceServiceContainer(
      mockWallet as any,
      undefined,
      mockPricing as any,
      mockFiat as any,
    )
    return render(
      <FinanceServicesProvider services={container}>
        <SendForm />
      </FinanceServicesProvider>,
    )
  }

  it('should render form elements with proper aria labels and test IDs', () => {
    renderSendForm()

    expect(screen.getByRole('form', { name: /Send payment form/i })).toBeInTheDocument()
    expect(screen.getByTestId('address-input')).toBeInTheDocument()
    expect(screen.getByTestId('amount-input')).toBeInTheDocument()
    expect(screen.getByTestId('memo-input')).toBeInTheDocument()
    expect(screen.getByTestId('review-button')).toBeInTheDocument()
  })

  it('should show validation error for invalid stellar address', async () => {
    mockWallet.validateAddress.mockReturnValue(false)
    renderSendForm()

    fireEvent.change(screen.getByTestId('address-input'), { target: { value: 'invalid' } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '100' } })
    fireEvent.click(screen.getByTestId('review-button'))

    await waitFor(() => {
      expect(screen.getByTestId('send-error')).toBeInTheDocument()
      expect(screen.getByTestId('send-error')).toHaveTextContent(/Invalid Stellar address/i)
    })
  })

  it('should show error for negative amount', async () => {
    renderSendForm()

    fireEvent.change(screen.getByTestId('address-input'), { target: { value: VALID_ADDRESS } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '-50' } })
    fireEvent.click(screen.getByTestId('review-button'))

    await waitFor(() => {
      expect(screen.getByTestId('send-error')).toBeInTheDocument()
    })
  })

  it('should call sendPayment with correct args on submit', async () => {
    renderSendForm()

    fireEvent.change(screen.getByTestId('address-input'), { target: { value: VALID_ADDRESS } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '100' } })
    fireEvent.change(screen.getByTestId('memo-input'), { target: { value: 'Test memo' } })
    await submitSendForm()

    await waitFor(() => {
      expect(mockWallet.sendPayment).toHaveBeenCalledWith(VALID_ADDRESS, 100, 'XLM', 'Test memo')
    })
  })

  it('should show success message after completed send', async () => {
    renderSendForm()

    fireEvent.change(screen.getByTestId('address-input'), { target: { value: VALID_ADDRESS } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '100' } })
    await submitSendForm()

    await waitFor(() => {
      expect(screen.getByTestId('send-success')).toBeInTheDocument()
    })
  })

  it('should show a distinct pending message when the ledger outcome is unconfirmed (Issue #63)', async () => {
    mockWallet.sendPayment.mockResolvedValue({ success: true, hash: 'a'.repeat(64), status: 'pending' })
    renderSendForm()

    fireEvent.change(screen.getByTestId('address-input'), { target: { value: VALID_ADDRESS } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '100' } })
    await submitSendForm()

    await waitFor(() => {
      const successEl = screen.getByTestId('send-success')
      expect(successEl).toBeInTheDocument()
      expect(successEl).toHaveTextContent(/awaiting network confirmation/i)
    })
    expect(screen.getByText('Send Submitted')).toBeInTheDocument()
  })

  it('should reset form on "Send another" click after success', async () => {
    renderSendForm()

    const addressInput = screen.getByTestId('address-input')
    fireEvent.change(addressInput, { target: { value: VALID_ADDRESS } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '100' } })
    await submitSendForm()

    await waitFor(() => {
      expect(screen.getByTestId('send-success')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('send-again-btn'))

    expect(screen.getByTestId('address-input')).toHaveValue('')
  })

  it('should show error when sendPayment fails', async () => {
    mockWallet.sendPayment.mockRejectedValueOnce(new Error('Network failure'))

    renderSendForm()

    fireEvent.change(screen.getByTestId('address-input'), { target: { value: VALID_ADDRESS } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '100' } })
    fireEvent.click(screen.getByTestId('review-button'))
    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-button')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('confirm-send-button'))

    await waitFor(() => {
      expect(screen.getByTestId('send-error')).toBeInTheDocument()
    })
  })

  it('should disable submit button while processing', async () => {
    mockWallet.sendPayment.mockReturnValueOnce(new Promise(() => {}))

    renderSendForm()

    fireEvent.change(screen.getByTestId('address-input'), { target: { value: VALID_ADDRESS } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '100' } })
    fireEvent.click(screen.getByTestId('review-button'))
    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-button')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('confirm-send-button'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-button')).toBeDisabled()
    })
  })

  it('should show fee estimate when amount is provided', () => {
    renderSendForm()

    expect(screen.queryByTestId('fee-estimate')).not.toBeInTheDocument()

    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '500' } })

    expect(screen.getByTestId('fee-estimate')).toBeInTheDocument()
  })
})
