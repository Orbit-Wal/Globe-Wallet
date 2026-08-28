/**
 * GET /api/sui/balance?address=0x...
 *
 * Real, read-only balance query against Sui testnet RPC — no signing key
 * required. See lib/sui/sui.service.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { suiService } from '@/lib/sui/sui.service'
import { SuiServiceError } from '@/lib/types'
import { ErrorCodes, apiError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')

  if (!address || !suiService.validateAddress(address)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'address is required and must be a valid Sui address'),
      { status: 422 },
    )
  }

  try {
    const balances = await suiService.getBalances(address)
    const network = suiService.getNetwork()
    return NextResponse.json(
      {
        network: network.name,
        address,
        balances,
      },
      { status: 200 },
    )
  } catch (err) {
    if (err instanceof SuiServiceError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch balances' },
      { status: 500 },
    )
  }
}
