/**
 * Unit tests for Issue #11 — crypto-native send flow helpers
 * Target: >90% branch/line/function coverage for lib/helpers/send-utils.ts
 * and lib/services/federation.service.ts
 */

import {
  isFederatedAddress,
  validateSendInput,
  formatFederatedDisplay,
} from '../../lib/helpers/send-utils'
import {
  FederationService,
  MOCK_FEDERATION_REGISTRY,
} from '../../lib/services/federation.service'

// ── isFederatedAddress ────────────────────────────────────────────────────────

describe('isFederatedAddress', () => {
  it('returns true for valid federated address', () => {
    expect(isFederatedAddress('alice*stellar.org')).toBe(true)
  })

  it('returns true for numeric local part', () => {
    expect(isFederatedAddress('123*example.com')).toBe(true)
  })

  it('returns true with subdomain', () => {
    expect(isFederatedAddress('user*pay.example.com')).toBe(true)
  })

  it('returns false for a plain Stellar public key', () => {
    expect(isFederatedAddress('GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isFederatedAddress('')).toBe(false)
  })

  it('returns false for null/undefined cast', () => {
    expect(isFederatedAddress(null as unknown as string)).toBe(false)
    expect(isFederatedAddress(undefined as unknown as string)).toBe(false)
  })

  it('returns false when there is no TLD (no dot after star)', () => {
    expect(isFederatedAddress('user*nodomain')).toBe(false)
  })

  it('returns false for multiple stars', () => {
    expect(isFederatedAddress('user*too*many.stars')).toBe(false)
  })

  it('returns false for address with spaces', () => {
    expect(isFederatedAddress('ali ce*stellar.org')).toBe(false)
  })

  it('returns false for email-like address (has @)', () => {
    expect(isFederatedAddress('alice@stellar.org')).toBe(false)
  })

  it('returns false when local part is empty', () => {
    expect(isFederatedAddress('*stellar.org')).toBe(false)
  })
})

// ── validateSendInput ─────────────────────────────────────────────────────────

const VALID_G_ADDRESS = 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX'

describe('validateSendInput', () => {
  it('passes for valid G-address and positive amount', () => {
    const r = validateSendInput(VALID_G_ADDRESS, '100')
    expect(r.valid).toBe(true)
    expect(r.error).toBeUndefined()
  })

  it('passes for federated address (defers address validation)', () => {
    const r = validateSendInput('alice*stellar.org', '50')
    expect(r.valid).toBe(true)
  })

  it('fails when address is empty', () => {
    const r = validateSendInput('', '10')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/required/i)
  })

  it('fails when address is whitespace only', () => {
    const r = validateSendInput('   ', '10')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/required/i)
  })

  it('fails for invalid non-federated address', () => {
    const r = validateSendInput('not-a-valid-address', '10')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/Invalid Stellar address/i)
  })

  it('fails for amount of zero', () => {
    const r = validateSendInput(VALID_G_ADDRESS, '0')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/valid amount/i)
  })

  it('fails for negative amount', () => {
    const r = validateSendInput(VALID_G_ADDRESS, '-5')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/valid amount/i)
  })

  it('fails for NaN amount', () => {
    const r = validateSendInput(VALID_G_ADDRESS, 'abc')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/valid amount/i)
  })

  it('fails for empty amount string', () => {
    const r = validateSendInput(VALID_G_ADDRESS, '')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/valid amount/i)
  })

  it('passes for fractional amount', () => {
    const r = validateSendInput(VALID_G_ADDRESS, '0.0001')
    expect(r.valid).toBe(true)
  })
})

// ── formatFederatedDisplay ────────────────────────────────────────────────────

describe('formatFederatedDisplay', () => {
  const KEY = 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX'

  it('formats input + resolved key', () => {
    const out = formatFederatedDisplay('alice*stellar.org', KEY)
    expect(out).toBe('alice*stellar.org → GDXSPAYW…T6BNRX')
  })

  it('returns input alone when no resolved key', () => {
    expect(formatFederatedDisplay('alice*stellar.org')).toBe('alice*stellar.org')
    expect(formatFederatedDisplay('alice*stellar.org', undefined)).toBe('alice*stellar.org')
  })

  it('handles short keys gracefully (overlapping slices)', () => {
    const out = formatFederatedDisplay('u*x.io', 'GABCDE')
    // slice(0,8) → 'GABCDE', slice(-6) → 'GABCDE' for a 6-char string
    expect(out).toBe('u*x.io → GABCDE…GABCDE')
  })
})

// ── FederationService ─────────────────────────────────────────────────────────

describe('FederationService', () => {
  const service = new FederationService(MOCK_FEDERATION_REGISTRY)

  describe('isFederated', () => {
    it('returns true for a federated address', () => {
      expect(service.isFederated('alice*stellar.org')).toBe(true)
    })

    it('returns false for a G-address', () => {
      expect(service.isFederated(VALID_G_ADDRESS)).toBe(false)
    })
  })

  describe('lookup', () => {
    it('resolves a known federated address', async () => {
      const result = await service.lookup('alice*stellar.org')
      expect(result.status).toBe('resolved')
      expect(result.resolved).toBe('GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX')
      expect(result.federationMemo).toBeUndefined()
    })

    it('resolves and includes memo when present', async () => {
      const result = await service.lookup('test*globe.wallet')
      expect(result.status).toBe('resolved')
      expect(result.resolved).toBe('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')
      expect(result.federationMemo).toBe('GLOBE-TEST')
    })

    it('returns not-found for unknown address', async () => {
      const result = await service.lookup('nobody*unknown.example')
      expect(result.status).toBe('not-found')
      expect(result.input).toBe('nobody*unknown.example')
      expect(result.resolved).toBeUndefined()
    })

    it('returns error for non-federated input', async () => {
      const result = await service.lookup('GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX')
      expect(result.status).toBe('error')
      expect(result.error).toMatch(/Not a federated address/i)
    })

    it('lowercases the key before lookup', async () => {
      const result = await service.lookup('ALICE*STELLAR.ORG')
      expect(result.status).toBe('resolved')
    })

    it('returns error when registry record has invalid account_id', async () => {
      const badService = new FederationService({
        'bad*actor.test': { account_id: 'NOT_A_VALID_KEY' },
      })
      const result = await badService.lookup('bad*actor.test')
      expect(result.status).toBe('error')
      expect(result.error).toMatch(/invalid Stellar address/i)
    })
  })
})
