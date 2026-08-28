import { OffRampService } from '../../../lib/services/off-ramp.service'
import { OffRampServiceError } from '../../../lib/types'

describe('OffRampService', () => {
    let service: OffRampService
    const originalAnchorUrl = process.env.SEP24_ANCHOR_URL
    const originalFetch = global.fetch

    beforeEach(() => {
        service = new OffRampService()
        process.env.SEP24_ANCHOR_URL = 'https://testanchor.example.com'
    })

    afterEach(() => {
        process.env.SEP24_ANCHOR_URL = originalAnchorUrl
        global.fetch = originalFetch
        jest.restoreAllMocks()
    })

    describe('getMethods', () => {
        it('should return available off-ramp methods', () => {
            const methods = service.getMethods()
            expect(methods).toHaveLength(3)
            expect(methods.some(m => m.name.includes('Bank'))).toBe(true)
        })
    })

    describe('initiateWithdrawal', () => {
        it('initiates a real SEP-24 interactive withdrawal against the configured anchor', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ type: 'interactive_customer_info_needed', url: 'https://testanchor.example.com/interactive', id: 'anchor-tx-1' }),
            }) as unknown as typeof fetch

            const result = await service.initiateWithdrawal(50, 'XLM', 'bank-1', 'NGN', 'GABC123')
            expect(result.status).toBe('pending')
            expect(result.hash).toBe('anchor-tx-1')
            expect(result.interactiveUrl).toBe('https://testanchor.example.com/interactive')
            expect(global.fetch).toHaveBeenCalledWith(
                'https://testanchor.example.com/transactions/withdraw/interactive',
                expect.objectContaining({ method: 'POST' }),
            )
        })

        it('should throw error for negative amount', async () => {
            await expect(service.initiateWithdrawal(-10, 'XLM', 'bank-1', 'NGN', 'GABC123'))
                .rejects.toThrow(OffRampServiceError)
        })

        it('should throw when no anchor is configured', async () => {
            delete process.env.SEP24_ANCHOR_URL
            await expect(service.initiateWithdrawal(50, 'XLM', 'bank-1', 'NGN', 'GABC123'))
                .rejects.toThrow(OffRampServiceError)
        })

        it('should throw when no account is provided', async () => {
            await expect(service.initiateWithdrawal(50, 'XLM', 'bank-1', 'NGN'))
                .rejects.toThrow(OffRampServiceError)
        })
    })
})
