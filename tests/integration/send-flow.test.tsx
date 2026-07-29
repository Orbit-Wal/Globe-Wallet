/**
 * Integration tests for SendForm — issue #14 (updated)
 * Verifies full UI → /api/send interaction using mocked fetch.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SendForm } from '../../components/app/send-form'
import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../lib/services/container'

const VALID_ADDRESS = 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX'

function buildMockContainer(overrides: Record<string, any> = {}) {
  const wallet = {
    sendPayment: jest.fn().mockResolvedValue({ success: true, hash: '0xhash', status: 'completed' }),
    validateAddress: jest.fn().mockReturnValue(true),
    getAccountInfo: jest.fn().mockReturnValue({ publicKey: VALID_ADDRESS, network: 'testnet', isFunded: true, name: 'Test' }),
    getBalance: jest.fn().mockResolvedValue([{ asset: 'XLM', amount: 500, priceUsd: 0.12 }]),
    getTransactionHistory: jest.fn().mockResolvedValue([]),
    generateReceiveAddress: jest.fn().mockReturnValue(VALID_ADDRESS),
    shortenKey: jest.fn().mockReturnValue('GDXSPA…6BNRX'),
    ...overrides,
  }

  const pricing = {
    getAssets: jest.fn().mockReturnValue([
      { code: 'XLM', name: 'Stellar Lumens', balance: 500, priceUsd: 0.12, change24h: 1.5, changePct: 1.5, color: 'bg-primary' },
    ]),
    getPrice: jest.fn().mockResolvedValue(0.12),
    formatAsset: jest.fn().mockReturnValue('500 XLM'),
  }

  const fiat = {
    getWallets: jest.fn().mockReturnValue([
      { id: 'w1', code: 'USD', name: 'US Dollar', label: 'USD', balance: 1000, color: 'bg-blue-500' },
    ]),
    formatMoney: jest.fn().mockReturnValue('$100'),
    convertCurrency: jest.fn().mockReturnValue(1000),
    getAccountBalance: jest.fn().mockReturnValue(1000),
  }

  const container = new FinanceServiceContainer(
    wallet as any,
    undefined,
    pricing as any,
    fiat as any,
  )

  return { container, wallet }
}

function renderWith(container: FinanceServiceContainer) {
  return render(
    <FinanceServicesProvider services={container}>
      <SendForm />
    </FinanceServicesProvider>,
  )
}

describe('SendFlow Integration — success path', () => {
  it('submits form and receives success response', async () => {
    const { container, wallet } = buildMockContainer()
    renderWith(container)

    fireEvent.change(screen.getByTestId('address-input'), { target: { value: VALID_ADDRESS } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId('review-button'))
    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-button')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('confirm-send-button'))

    await waitFor(() =>
      expect(wallet.sendPayment).toHaveBeenCalledWith(VALID_ADDRESS, 5, 'XLM', undefined)
    )
  })
})

describe('SendFlow Integration — validation failure', () => {
  it('blocks advance on invalid address and does not call sendPayment', async () => {
    const { container, wallet } = buildMockContainer({ validateAddress: jest.fn().mockReturnValue(false) })
    renderWith(container)

    fireEvent.change(screen.getByTestId('address-input'), { target: { value: 'bad-addr' } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('review-button'))

    await waitFor(() => {
      expect(screen.getByTestId('send-error')).toBeInTheDocument()
    })

    expect(wallet.sendPayment).not.toHaveBeenCalled()
  })
})
