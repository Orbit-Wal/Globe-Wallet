/**
 * Integration tests for ReceiveForm UI — issue #22
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReceiveForm } from '../../components/app/receive-form'
import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../lib/services/container'
import { TEST_STELLAR_ADDRESS } from '../../lib/finance-data'

jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <div data-testid="mock-qr" data-value={value} />
  ),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

const VALID_ADDRESS = TEST_STELLAR_ADDRESS

function buildContainer() {
  const wallet = {
    sendPayment: jest.fn(),
    validateAddress: jest.fn().mockReturnValue(true),
    getAccountInfo: jest.fn().mockReturnValue({ publicKey: VALID_ADDRESS, name: 'P', isFunded: true }),
    getBalance: jest.fn().mockResolvedValue([]),
    generateReceiveAddress: jest.fn().mockReturnValue(VALID_ADDRESS),
    getTransactionHistory: jest.fn().mockResolvedValue([]),
    shortenKey: jest.fn((k: string) => k.slice(0, 6) + '…'),
  }
  const pricing = {
    getAssets: jest.fn().mockReturnValue([]),
    getPrice: jest.fn().mockResolvedValue(0.12),
    formatAsset: jest.fn((a: number, c: string) => `${a} ${c}`),
  }
  const fiat = {
    getWallets: jest.fn().mockReturnValue([]),
    convertCurrency: jest.fn().mockReturnValue(0),
    getExchangeRate: jest.fn().mockReturnValue(1),
    getAccountBalance: jest.fn().mockReturnValue(0),
  }
  return new FinanceServiceContainer(wallet as any, undefined, pricing as any, fiat as any)
}

describe('Receive flow integration — issue #22', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads receive address from wallet service', () => {
    render(
      <FinanceServicesProvider services={buildContainer()}>
        <ReceiveForm />
      </FinanceServicesProvider>
    )
    expect(screen.getByTestId('receive-address')).toHaveTextContent(VALID_ADDRESS)
  })

  it('updates payment QR when amount and memo change', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <FinanceServicesProvider services={buildContainer()}>
        <ReceiveForm />
      </FinanceServicesProvider>
    )

    await user.click(screen.getByTestId('tab-request'))
    await user.type(screen.getByTestId('receive-amount-input'), '20')
    await user.type(screen.getByTestId('receive-memo-input'), 'API')

    await waitFor(() => {
      const qr = screen.getByTestId('payment-qr')
      const value = qr.getAttribute('data-value') ?? ''
      expect(value).toContain('amount=20')
      expect(value).toContain('memo=API')
    })
  })

  it('disables payment actions when amount validation fails', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <FinanceServicesProvider services={buildContainer()}>
        <ReceiveForm />
      </FinanceServicesProvider>
    )

    await user.click(screen.getByTestId('tab-request'))
    await user.type(screen.getByTestId('receive-amount-input'), '-1')

    await waitFor(() => {
      expect(screen.getByTestId('receive-amount-error')).toBeInTheDocument()
      expect(screen.getByTestId('copy-payment-button')).toBeDisabled()
    })
  })
})
