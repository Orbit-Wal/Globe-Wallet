/**
 * GET /api/federation?q=user*domain.tld
 *
 * Stellar Federation Protocol proxy (Issue #11).
 * Resolves a human-readable federated address to a Stellar public key and
 * optional memo using the mock registry from FederationService.
 *
 * In production, swap FederationService.lookup() for a real SEP-0002 fetch.
 *
 * Security: No private keys are accepted or returned. Only public account IDs
 * and optional text/id memos are surfaced. Validate the returned account_id
 * client-side with isValidStellarAddress() before using in a transaction.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { federationService } from '../../../lib/services/federation.service'
import { ErrorCodes, apiError } from '../../../lib/errors'
import { parseQuery } from '@/lib/api/http'

const QuerySchema = z.object({
  q: z.string().trim().min(1, 'q parameter is required'),
})

// Issue #68: intentionally PUBLIC — resolves a federated address to a
// public Stellar account id only; no private keys accepted or returned
// (see file header).
export async function GET(request: NextRequest) {
  const parsed = parseQuery(request, QuerySchema)
  if (!parsed.ok) return parsed.response
  const q = parsed.data.q

  if (!federationService.isFederated(q.trim())) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_NOT_FEDERATED, 'address does not match user*domain.tld format'),
      { status: 400 },
    )
  }

  const result = await federationService.lookup(q.trim())

  if (result.status === 'not-found') {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_NOT_FOUND, `no federation record for "${q}"`),
      { status: 404 },
    )
  }

  if (result.status === 'error') {
    return NextResponse.json(
      { error: result.error ?? ErrorCodes.ERR_LOOKUP_FAILED },
      { status: 502 },
    )
  }

  return NextResponse.json(
    {
      stellar_address: q.trim(),
      account_id: result.resolved,
      ...(result.federationMemo != null && { memo: result.federationMemo, memo_type: 'text' }),
    },
    { status: 200 },
  )
}
