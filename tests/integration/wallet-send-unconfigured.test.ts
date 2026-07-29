/** @jest-environment node */

// This file intentionally never sets STELLAR_SOURCE_SECRET_KEY, so the route
// module under test is constructed against a genuinely unconfigured
// environment for its entire lifetime — see Issue #63: a missing signing
// key must fail loudly (503 ERR_PAYMENT_NOT_CONFIGURED), not silently
// fabricate a "successful" payment the way the old route did.
delete process.env.STELLAR_SOURCE_SECRET_KEY

import { NextRequest } from 'next/server'
import { POST as sendPOST } from '../../app/api/wallet/send/route'

describe('/api/wallet/send — unconfigured signing key', () => {
  it('returns 503 ERR_PAYMENT_NOT_CONFIGURED instead of a fabricated success', async () => {
    const request = new NextRequest('http://localhost/api/wallet/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
      body: JSON.stringify({
        destination: 'GBID26P7CMFHLDFV35TT5RKQHTA6QARBYCBCNW2QIXVPMKE6MSE3FCDV',
        amount: 10,
        asset: 'XLM',
      }),
    })

    const response = await sendPOST(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toContain('ERR_PAYMENT_NOT_CONFIGURED')
    expect(data.error).toContain('STELLAR_SOURCE_SECRET_KEY')
  })
})
