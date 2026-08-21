/** @jest-environment node */
import { LiveFederationService } from '../../../lib/services/federation.service'

describe('LiveFederationService (Issue #66)', () => {
  // Both targets below are IP literals, so no real DNS query happens —
  // Node resolves an IP literal to itself, exercising the SSRF guard's
  // private-range check deterministically without network access.
  it('rejects a lookup targeting a loopback IP literal', async () => {
    const service = new LiveFederationService()
    const result = await service.lookup('user*127.0.0.1')
    expect(result.status).toBe('error')
  })

  it('rejects a lookup targeting a private IP literal', async () => {
    const service = new LiveFederationService()
    const result = await service.lookup('user*192.168.1.1')
    expect(result.status).toBe('error')
  })

  it('returns an error status (not a throw) for a non-federated address', async () => {
    const service = new LiveFederationService()
    const result = await service.lookup('not-a-federated-address')
    expect(result.status).toBe('error')
  })
})
