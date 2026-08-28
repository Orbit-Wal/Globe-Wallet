/**
 * GET /api/evm/balance?chainId=base&address=0x...
 *
 * Real, read-only balance query against Base Sepolia / Ethereum Sepolia
 * testnet RPCs — no signing key required. See lib/evm/evm.service.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { evmService } from '@/lib/evm/evm.service'
import { EvmServiceError, type EvmChainId } from '@/lib/types'
import { ErrorCodes, apiError } from '@/lib/errors'
import { parseQuery } from '@/lib/api/http'

const SUPPORTED_CHAIN_IDS: EvmChainId[] = ['base', 'ethereum']

const QuerySchema = z.object({
  chainId: z.enum(SUPPORTED_CHAIN_IDS as [EvmChainId, ...EvmChainId[]], {
    errorMap: () => ({ message: `chainId must be one of: ${SUPPORTED_CHAIN_IDS.join(', ')}` }),
  }),
  address: z.string().min(1, 'address is required'),
})

// Issue #68: intentionally PUBLIC — read-only balance query against a
// public EVM address, no signing key required (see file header).
export async function GET(request: NextRequest) {
  const parsed = parseQuery(request, QuerySchema)
  if (!parsed.ok) return parsed.response
  const { chainId, address } = parsed.data

  if (!evmService.validateAddress(address)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'address is required and must be a valid EVM address'),
      { status: 422 },
    )
  }

  try {
    const balances = await evmService.getBalances(chainId as EvmChainId, address)
    const network = evmService.getNetwork(chainId as EvmChainId)
    return NextResponse.json(
      {
        chainId,
        network: network.name,
        address,
        balances,
      },
      { status: 200 },
    )
  } catch (err) {
    if (err instanceof EvmServiceError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch balances' },
      { status: 500 },
    )
  }
}
