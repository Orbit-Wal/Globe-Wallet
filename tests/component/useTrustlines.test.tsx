import { renderHook, act } from '@testing-library/react'
import { useTrustlines } from '../../hooks/useTrustlines'
import { useToast } from '../../hooks/use-toast'
import { useFinanceServices } from '../../hooks/useFinanceServices'

jest.mock('../../hooks/use-toast')
jest.mock('../../hooks/useFinanceServices')

const mockToast = jest.fn()
const mockWalletService = {
  getTrustlines: jest.fn(),
  changeTrustline: jest.fn()
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
  ;(useFinanceServices as jest.Mock).mockReturnValue({ wallet: mockWalletService })
  global.fetch = jest.fn()
})

describe('useTrustlines hook', () => {
  it('should fetch trustlines on mount', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ asset: 'XLM' }, { asset: 'USDC' }]
    })

    const { result } = renderHook(() => useTrustlines())

    expect(result.current.loading).toBe(true)
    
    // Wait for the async effect to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/wallet/trustlines')
    expect(result.current.loading).toBe(false)
    expect(result.current.trustlines.length).toBe(2)
  })

  it('should call changeTrustline successfully', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { action: 'add', asset: 'USDT' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ asset: 'USDT' }]
      })

    const { result } = renderHook(() => useTrustlines())

    // Wait for initial fetch
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    let success;
    await act(async () => {
      success = await result.current.changeTrustline('USDT', 'add')
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/wallet/trustlines', expect.any(Object))
    expect(success).toEqual({ action: 'add', asset: 'USDT' })
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Trustline added' }))
    expect(result.current.trustlines.length).toBe(1)
  })

  it('should handle API error on changeTrustline', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Insufficient reserve' })
      })

    const { result } = renderHook(() => useTrustlines())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    let success;
    await act(async () => {
      success = await result.current.changeTrustline('USDT', 'add')
    })

    expect(success).toBeNull()
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'Insufficient reserve' }))
  })
})
