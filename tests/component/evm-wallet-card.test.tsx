import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EvmWalletCard } from '../../components/app/evm-wallet-card'

const ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

describe('EvmWalletCard', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('defaults to the Base tab', () => {
    render(<EvmWalletCard />)
    expect(screen.getByTestId('evm-chain-base')).toHaveAttribute('data-state', 'active')
  })

  it('fetches and displays balances for the entered address', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        chainId: 'base',
        network: 'Base Sepolia',
        address: ADDRESS,
        balances: [
          { symbol: 'ETH', amount: 1.5, raw: '1500000000000000000', decimals: 18 },
          { symbol: 'USDC', amount: 100, raw: '100000000', decimals: 6 },
        ],
      }),
    })

    render(<EvmWalletCard />)

    fireEvent.change(screen.getByTestId('evm-address-input'), { target: { value: ADDRESS } })
    fireEvent.click(screen.getByTestId('evm-check-balance-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('evm-balance-ETH')).toHaveTextContent('1.5')
      expect(screen.getByTestId('evm-balance-USDC')).toHaveTextContent('100')
    })

    expect(global.fetch).toHaveBeenCalledWith(`/api/evm/balance?chainId=base&address=${ADDRESS}`)
  })

  it('shows an error alert when the balance lookup fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'ERR_INVALID_ADDRESS: not a valid EVM address' }),
    })

    render(<EvmWalletCard />)
    fireEvent.change(screen.getByTestId('evm-address-input'), { target: { value: 'bad' } })
    fireEvent.click(screen.getByTestId('evm-check-balance-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('evm-balance-error')).toHaveTextContent('ERR_INVALID_ADDRESS')
    })
  })

  it('submits a send request and shows the confirmation on success', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, status: 'completed', hash: '0xabc123' }),
    })

    render(<EvmWalletCard />)

    fireEvent.change(screen.getByTestId('evm-send-destination'), { target: { value: ADDRESS } })
    fireEvent.change(screen.getByTestId('evm-send-amount'), { target: { value: '0.01' } })
    fireEvent.click(screen.getByTestId('evm-send-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('evm-send-success')).toHaveTextContent('0xabc123')
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/evm/send',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ chainId: 'base', destination: ADDRESS, amount: 0.01 }),
      }),
    )
  })

  it('shows an error when the send is not configured server-side', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'ERR_PAYMENT_NOT_CONFIGURED: Live EVM payment submission is not configured.' }),
    })

    render(<EvmWalletCard />)
    fireEvent.change(screen.getByTestId('evm-send-destination'), { target: { value: ADDRESS } })
    fireEvent.change(screen.getByTestId('evm-send-amount'), { target: { value: '0.01' } })
    fireEvent.click(screen.getByTestId('evm-send-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('evm-send-error')).toHaveTextContent('ERR_PAYMENT_NOT_CONFIGURED')
    })
  })

  it('switches chains via tabs', async () => {
    const user = userEvent.setup()
    render(<EvmWalletCard />)
    await user.click(screen.getByTestId('evm-chain-ethereum'))
    expect(screen.getByTestId('evm-chain-ethereum')).toHaveAttribute('data-state', 'active')
    expect(screen.getByText(/Ethereum Sepolia/)).toBeInTheDocument()
  })
})
