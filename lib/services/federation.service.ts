/**
 * lib/services/federation.service.ts — Issue #11
 * Implements the Stellar Federation Protocol (SEP-0002) for resolving
 * human-readable addresses (user*domain.tld) to Stellar public keys.
 *
 * In production this would fetch the domain's stellar.toml to find the
 * FEDERATION_SERVER URL, then call GET /federation?q=...&type=name.
 * Here we use a mock registry that is injected for tests and used by
 * the /api/federation route in development/CI.
 *
 * Security note: No private keys or secrets pass through this service.
 * Always validate the returned account_id with isValidStellarAddress()
 * before using it in a transaction.
 */

import type { AddressLookupResult, IFederationService } from '../types'
import { isFederatedAddress } from '../helpers/send-utils'
import { isValidStellarAddress } from '../helpers/format'
import { ssrfSafeFetch, SsrfBlockedError } from './federation-ssrf-guard'

export interface FederationRecord {
  account_id: string
  memo?: string
  memo_type?: 'text' | 'id' | 'hash'
}

/** Mock registry keyed by the full federated address string. */
export const MOCK_FEDERATION_REGISTRY: Record<string, FederationRecord> = {
  'alice*stellar.org': {
    account_id: 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX',
  },
  'test*globe.wallet': {
    account_id: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    memo: 'GLOBE-TEST',
    memo_type: 'text',
  },
}

export class FederationService implements IFederationService {
  private readonly registry: Record<string, FederationRecord>

  constructor(registry: Record<string, FederationRecord> = MOCK_FEDERATION_REGISTRY) {
    this.registry = registry
  }

  isFederated(input: string): boolean {
    return isFederatedAddress(input)
  }

  async lookup(federatedAddress: string): Promise<AddressLookupResult> {
    const input = federatedAddress.trim().toLowerCase()

    if (!this.isFederated(input)) {
      return { status: 'error', input, error: 'Not a federated address.' }
    }

    const record = this.registry[input]

    if (!record) {
      return { status: 'not-found', input }
    }

    if (!isValidStellarAddress(record.account_id)) {
      return {
        status: 'error',
        input,
        error: 'Federation record contains an invalid Stellar address.',
      }
    }

    return {
      status: 'resolved',
      input,
      resolved: record.account_id,
      federationMemo: record.memo,
    }
  }
}

/**
 * Issue #66: real SEP-0002 resolution — fetches the domain's stellar.toml
 * for FEDERATION_SERVER, then queries it, instead of a hardcoded registry.
 * Every outbound request goes through ssrfSafeFetch (https-only, blocks
 * private/loopback/link-local resolved IPs, times out, caps response size)
 * since the domain is entirely user-controlled input here.
 */
export class LiveFederationService implements IFederationService {
  isFederated(input: string): boolean {
    return isFederatedAddress(input)
  }

  async lookup(federatedAddress: string): Promise<AddressLookupResult> {
    const input = federatedAddress.trim().toLowerCase()

    if (!this.isFederated(input)) {
      return { status: 'error', input, error: 'Not a federated address.' }
    }

    const domain = input.split('*')[1]
    if (!domain) {
      return { status: 'error', input, error: 'Not a federated address.' }
    }

    try {
      const tomlText = await ssrfSafeFetch(`https://${domain}/.well-known/stellar.toml`)
      const federationServerUrl = extractFederationServerUrl(tomlText)
      if (!federationServerUrl) {
        return { status: 'not-found', input, error: 'Domain has no FEDERATION_SERVER in stellar.toml.' }
      }

      const queryUrl = `${federationServerUrl}${federationServerUrl.includes('?') ? '&' : '?'}q=${encodeURIComponent(input)}&type=name`
      const recordText = await ssrfSafeFetch(queryUrl)

      let record: FederationRecord
      try {
        record = JSON.parse(recordText)
      } catch {
        return { status: 'error', input, error: 'Federation server returned invalid JSON.' }
      }

      if (!record?.account_id) {
        return { status: 'not-found', input }
      }

      // Defense in depth, same as the mock registry path: never trust an
      // externally-fetched account_id without re-validating it.
      if (!isValidStellarAddress(record.account_id)) {
        return { status: 'error', input, error: 'Federation record contains an invalid Stellar address.' }
      }

      return {
        status: 'resolved',
        input,
        resolved: record.account_id,
        federationMemo: record.memo,
      }
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        return { status: 'error', input, error: err.message }
      }
      return { status: 'error', input, error: 'Federation lookup failed.' }
    }
  }
}

/** Extracts FEDERATION_SERVER = "..." from a stellar.toml body without a full TOML parser. */
function extractFederationServerUrl(toml: string): string | null {
  const match = toml.match(/^\s*FEDERATION_SERVER\s*=\s*"([^"]+)"\s*$/m)
  if (!match) return null
  const url = match[1]
  return url.startsWith('https://') ? url : null
}

export const federationService =
  process.env.NEXT_PUBLIC_APP_ENV === 'live' ? new LiveFederationService() : new FederationService()
