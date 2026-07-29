import { GET, POST } from '../../app/api/wallet/trustlines/route'
import { financeServices } from '../../lib/services/container'

jest.mock('../../lib/services/container', () => ({
  financeServices: {
    wallet: {
      getTrustlines: jest.fn(),
      changeTrustline: jest.fn()
    }
  }
}))

describe('Trustlines API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/wallet/trustlines', () => {
    it('should return trustlines', async () => {
      ;(financeServices.wallet.getTrustlines as jest.Mock).mockResolvedValue([{ asset: 'USDC' }])
      
      const response = await GET()
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toEqual([{ asset: 'USDC' }])
    })

    it('should handle errors', async () => {
      ;(financeServices.wallet.getTrustlines as jest.Mock).mockRejectedValue(new Error('DB Error'))
      
      const response = await GET()
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBe('DB Error')
    })
  })

  describe('POST /api/wallet/trustlines', () => {
    it('should successfully change trustline', async () => {
      ;(financeServices.wallet.changeTrustline as jest.Mock).mockResolvedValue({ success: true, action: 'add' })
      
      const request = new Request('http://localhost/api/wallet/trustlines', {
        method: 'POST',
        body: JSON.stringify({ asset: 'USDT', action: 'add' })
      })

      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.action).toBe('add')
      expect(financeServices.wallet.changeTrustline).toHaveBeenCalledWith('USDT', 'add')
    })

    it('should validate missing fields', async () => {
      const request = new Request('http://localhost/api/wallet/trustlines', {
        method: 'POST',
        body: JSON.stringify({ asset: 'USDT' }) // missing action
      })

      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toMatch(/Missing required fields/)
    })

    it('should validate action type', async () => {
      const request = new Request('http://localhost/api/wallet/trustlines', {
        method: 'POST',
        body: JSON.stringify({ asset: 'USDT', action: 'invalid' })
      })

      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toMatch(/Action must be/)
    })

    it('should handle service errors', async () => {
      ;(financeServices.wallet.changeTrustline as jest.Mock).mockRejectedValue(new Error('Cannot add duplicate trustline'))
      
      const request = new Request('http://localhost/api/wallet/trustlines', {
        method: 'POST',
        body: JSON.stringify({ asset: 'USDC', action: 'add' })
      })

      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBe('Cannot add duplicate trustline')
    })
  })
})
