/**
 * @jest-environment node
 *
 * Isolated in its own file (separate module registry from evm-api.test.ts)
 * so EvmPaymentService's lazy singleton sees EVM_SOURCE_PRIVATE_KEY unset,
 * mirroring wallet-send-unconfigured.test.ts for the Stellar send route.
 */

delete process.env.EVM_SOURCE_PRIVATE_KEY

import { NextRequest } from 'next/server'
import { POST as sendPOST } from '../../app/api/evm/send/route'

describe('POST /api/evm/send (unconfigured)', () => {
  it('returns 503 ERR_PAYMENT_NOT_CONFIGURED when no signing key is set', async () => {
    const req = new NextRequest('http://localhost/api/evm/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
      body: JSON.stringify({
        chainId: 'base',
        destination: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        amount: 0.01,
      }),
    })

    const response = await sendPOST(req)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toMatch(/ERR_PAYMENT_NOT_CONFIGURED/)
  })
})
