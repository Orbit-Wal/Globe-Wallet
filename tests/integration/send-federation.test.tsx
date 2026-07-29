/**
 * Integration tests for Issue #11 — Federated address send flow
 *
 * Tests the full UI → hook → /api/federation → send path using:
 *  - A mocked global fetch (simulating /api/federation responses)
 *  - The real SendForm rendered inside a FinanceServicesProvider
 *
 * Coverage targets:
 *  - Federated address triggers lookup badge
 *  - Resolved address is used for actual sendPayment call
 *  - Unresolvable federated address blocks form advance
 *  - Error from federation API shows error in form
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SendForm } from '../../components/app/send-form'
import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../lib/services/container'

const FEDERATED_INPUT = 'alice*stellar.org'
const RESOLVED_KEY = 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX'
const VALID_ADDRESS = 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX'

function buildContainer(sendPaymentImpl?: jest.Mock) {
  const wallet = {
    sendPayment:
      sendPaymentImpl ??
      jest.fn().mockResolvedValue({ success: true, hash: '0xfed123', status: 'completed' }),
    validateAddress: jest.fn().mockReturnValue(true),
    getAccountInfo: jest.fn().mockReturnValue({
      publicKey: VALID_ADDRESS,
      network: 'testnet',
      isFunded: true,
      name: 'Test',
    }),
    getBalance: jest.fn().mockResolvedValue([{ asset: 'XLM', amount: 500, priceUsd: 0.12 }]),
    getTransactionHistory: jest.fn().mockResolvedValue([]),
    generateReceiveAddress: jest.fn().mockReturnValue(VALID_ADDRESS),
    shortenKey: jest.fn().mockReturnValue('GDXSPA…BNRX'),
  }

  const pricing = {
    getAssets: jest.fn().mockReturnValue([
      {
        code: 'XLM',
        name: 'Stellar Lumens',
        balance: 500,
        priceUsd: 0.12,
        change24h: 1.5,
        changePct: 1.5,
        color: 'bg-primary',
      },
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

function renderSendForm(container: FinanceServiceContainer) {
  return render(
    <FinanceServicesProvider services={container}>
      <SendForm />
    </FinanceServicesProvider>,
  )
}

// ── Helper: mock fetch for /api/federation ────────────────────────────────────

function mockFederationFetch(response: object, status = 200) {
  return jest.spyOn(global, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(response), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SendFederationFlow Integration — resolved path', () => {
  afterEach(() => jest.restoreAllMocks())

  it('uses the resolved address when a federated input is provided', async () => {
    const { container, wallet } = buildContainer()
    mockFederationFetch({ account_id: RESOLVED_KEY })

    renderSendForm(container)

    fireEvent.change(screen.getByTestId('address-input'), {
      target: { value: FEDERATED_INPUT },
    })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '10' } })

    // Wait for the resolved badge to appear (debounce + fetch)
    await waitFor(
      () => expect(screen.getByTestId('lookup-resolved')).toBeInTheDocument(),
      { timeout: 2000 },
    )

    fireEvent.click(screen.getByTestId('review-button'))

    await waitFor(() =>
      expect(screen.getByTestId('confirm-send-button')).toBeInTheDocument(),
    )

    // Confirm summary shows the federation display
    expect(screen.getByTestId('send-summary')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('confirm-send-button'))

    await waitFor(() =>
      expect(wallet.sendPayment).toHaveBeenCalledWith(
        RESOLVED_KEY,
        10,
        'XLM',
        undefined,
      ),
    )
  })
})

describe('SendFederationFlow Integration — not-found path', () => {
  afterEach(() => jest.restoreAllMocks())

  it('blocks form advance when federation returns 404', async () => {
    const { container, wallet } = buildContainer()
    mockFederationFetch({ error: 'ERR_NOT_FOUND' }, 404)

    renderSendForm(container)

    fireEvent.change(screen.getByTestId('address-input'), {
      target: { value: 'ghost*unknown.example' },
    })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '5' } })

    await waitFor(
      () => expect(screen.getByTestId('lookup-not-found')).toBeInTheDocument(),
      { timeout: 2000 },
    )

    fireEvent.click(screen.getByTestId('review-button'))

    await waitFor(() =>
      expect(screen.getByTestId('send-error')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('send-error')).toHaveTextContent(/No federation record/i)
    expect(wallet.sendPayment).not.toHaveBeenCalled()
  })
})

describe('SendFederationFlow Integration — normal G-key path unchanged', () => {
  afterEach(() => jest.restoreAllMocks())

  it('sends normally with a plain Stellar key (no federation call)', async () => {
    const { container, wallet } = buildContainer()
    const fetchSpy = jest.spyOn(global, 'fetch')

    renderSendForm(container)

    fireEvent.change(screen.getByTestId('address-input'), { target: { value: VALID_ADDRESS } })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '25' } })
    fireEvent.click(screen.getByTestId('review-button'))

    await waitFor(() =>
      expect(screen.getByTestId('confirm-send-button')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('confirm-send-button'))

    await waitFor(() =>
      expect(wallet.sendPayment).toHaveBeenCalledWith(VALID_ADDRESS, 25, 'XLM', undefined),
    )

    // fetch should not have been called for federation
    const federationCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('/api/federation'),
    )
    expect(federationCalls.length).toBe(0)
  })
})

describe('SendFederationFlow Integration — still-resolving guard', () => {
  afterEach(() => jest.restoreAllMocks())

  it('blocks form advance while federation lookup is in flight', async () => {
    const { container, wallet } = buildContainer()

    // Never resolves → lookup stays in "resolving" state
    jest
      .spyOn(global, 'fetch')
      .mockReturnValueOnce(new Promise(() => {}))

    renderSendForm(container)

    fireEvent.change(screen.getByTestId('address-input'), {
      target: { value: FEDERATED_INPUT },
    })
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '10' } })

    await waitFor(() =>
      expect(screen.getByTestId('lookup-resolving')).toBeInTheDocument(),
      { timeout: 2000 },
    )

    fireEvent.click(screen.getByTestId('review-button'))

    await waitFor(() =>
      expect(screen.getByTestId('send-error')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('send-error')).toHaveTextContent(/still resolving/i)
    expect(wallet.sendPayment).not.toHaveBeenCalled()
  })
})
