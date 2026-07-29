import * as React from 'react'
import { renderHook, act } from '@testing-library/react'
import { useWalletSend } from '../../../hooks/useWalletSend'
import { FinanceServicesProvider } from '../../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../../lib/services/container'

describe('useWalletSend Hook', () => {
    let mockWallet: any
    let mockContainer: any
    let wrapper: React.ComponentType<{ children: React.ReactNode }>

    beforeEach(() => {
        mockWallet = {
            sendPayment: jest.fn(),
            validateAddress: jest.fn().mockReturnValue(true),
            getAccountInfo: jest.fn().mockReturnValue({
                publicKey: 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX',
                name: 'Primary Wallet',
                network: 'Stellar Public Network',
                isFunded: true
            }),
            getBalance: jest.fn().mockResolvedValue([])
        }

        mockContainer = new FinanceServiceContainer(mockWallet)
        wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(FinanceServicesProvider, { services: mockContainer, children })
    })

    it('should initialize with idle status', () => {
        const { result } = renderHook(() => useWalletSend(), { wrapper })

        expect(result.current.status).toBe('idle')
        expect(result.current.isProcessing).toBe(false)
        expect(result.current.error).toBeNull()
        expect(result.current.result).toBeNull()
    })

    it('should fail client-side validation on invalid address', async () => {
        const { result } = renderHook(() => useWalletSend(), { wrapper })

        await act(async () => {
            await result.current.send('invalid-address', '10', 'XLM')
        })

        expect(result.current.status).toBe('error')
        expect(result.current.error).toContain('Invalid Stellar address')
        expect(mockWallet.sendPayment).not.toHaveBeenCalled()
    })

    it('should fail client-side validation on zero or negative amount', async () => {
        const { result } = renderHook(() => useWalletSend(), { wrapper })
        const validAddr = 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX'

        await act(async () => {
            await result.current.send(validAddr, '0', 'XLM')
        })

        expect(result.current.status).toBe('error')
        expect(result.current.error).toContain('must be greater than zero')

        await act(async () => {
            await result.current.send(validAddr, '-5', 'XLM')
        })

        expect(result.current.status).toBe('error')
        expect(result.current.error).toContain('must be greater than zero')
        expect(mockWallet.sendPayment).not.toHaveBeenCalled()
    })

    it('should perform a successful transaction send flow', async () => {
        const validAddr = 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX'
        const mockResult = { success: true, hash: '0xhash123', status: 'completed' }
        
        let resolveSend: (value: any) => void = () => {}
        const sendPaymentPromise = new Promise((resolve) => {
            resolveSend = resolve
        })
        mockWallet.sendPayment.mockReturnValue(sendPaymentPromise)

        const { result } = renderHook(() => useWalletSend(), { wrapper })

        let sendCallPromise: Promise<void>
        act(() => {
            sendCallPromise = result.current.send(validAddr, '100', 'XLM')
        })

        // Expect processing state while promise is pending
        expect(result.current.status).toBe('processing')
        expect(result.current.isProcessing).toBe(true)

        // Resolve and wait
        await act(async () => {
            resolveSend(mockResult)
            await sendCallPromise
        })

        expect(result.current.status).toBe('success')
        expect(result.current.isProcessing).toBe(false)
        expect(result.current.result).toEqual(mockResult)
        expect(result.current.error).toBeNull()
        expect(mockWallet.sendPayment).toHaveBeenCalledWith(validAddr, 100, 'XLM', undefined)
    })

    it('treats a pending ledger outcome as success (not error) — Issue #63', async () => {
        const validAddr = 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX'
        const mockResult = { success: true, hash: 'a'.repeat(64), status: 'pending' }
        mockWallet.sendPayment.mockResolvedValue(mockResult)

        const { result } = renderHook(() => useWalletSend(), { wrapper })

        await act(async () => {
            await result.current.send(validAddr, '100', 'XLM')
        })

        expect(result.current.status).toBe('success')
        expect(result.current.error).toBeNull()
        expect(result.current.result?.status).toBe('pending')
    })

    it('should handle service errors gracefully', async () => {
        const validAddr = 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX'
        const mockResult = { success: false, error: 'Destination account not funded', status: 'failed' }
        mockWallet.sendPayment.mockResolvedValue(mockResult)

        const { result } = renderHook(() => useWalletSend(), { wrapper })

        await act(async () => {
            await result.current.send(validAddr, '100', 'XLM')
        })

        expect(result.current.status).toBe('error')
        expect(result.current.isProcessing).toBe(false)
        expect(result.current.error).toBe('Destination account not funded')
    })

    it('should handle service exceptions gracefully', async () => {
        const validAddr = 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX'
        mockWallet.sendPayment.mockRejectedValue(new Error('Network loss'))

        const { result } = renderHook(() => useWalletSend(), { wrapper })

        await act(async () => {
            await result.current.send(validAddr, '100', 'XLM')
        })

        expect(result.current.status).toBe('error')
        expect(result.current.isProcessing).toBe(false)
        expect(result.current.error).toBe('Network loss')
    })

    it('should reset state back to idle on reset call', async () => {
        const { result } = renderHook(() => useWalletSend(), { wrapper })

        await act(async () => {
            await result.current.send('invalid-address', '10', 'XLM')
        })
        expect(result.current.status).toBe('error')

        act(() => {
            result.current.reset()
        })

        expect(result.current.status).toBe('idle')
        expect(result.current.error).toBeNull()
        expect(result.current.result).toBeNull()
    })
})
