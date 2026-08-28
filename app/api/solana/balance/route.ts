/**
 * GET /api/solana/balance?address=...
 *
 * Real, read-only balance query against Solana devnet RPC — no signing key
 * required. See lib/solana/solana.service.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { solanaService } from '@/lib/solana/solana.service'
import { SolanaServiceError } from '@/lib/types'
import { ErrorCodes, apiError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')

  if (!address || !solanaService.validateAddress(address)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'address is required and must be a valid Solana address'),
      { status: 422 },
    )
  }

  try {
    const balances = await solanaService.getBalances(address)
    const network = solanaService.getNetwork()
    return NextResponse.json(
      {
        network: network.name,
        address,
        balances,
      },
      { status: 200 },
    )
  } catch (err) {
    if (err instanceof SolanaServiceError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch balances' },
      { status: 500 },
    )
  }
}
