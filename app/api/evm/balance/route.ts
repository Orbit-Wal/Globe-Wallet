/**
 * GET /api/evm/balance?chainId=base&address=0x...
 *
 * Real, read-only balance query against Base Sepolia / Ethereum Sepolia
 * testnet RPCs — no signing key required. See lib/evm/evm.service.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { evmService } from '@/lib/evm/evm.service'
import { EvmServiceError, type EvmChainId } from '@/lib/types'
import { ErrorCodes, apiError } from '@/lib/errors'

const SUPPORTED_CHAIN_IDS: EvmChainId[] = ['base', 'ethereum']

export async function GET(request: NextRequest) {
  const chainId = request.nextUrl.searchParams.get('chainId')
  const address = request.nextUrl.searchParams.get('address')

  if (!chainId || !SUPPORTED_CHAIN_IDS.includes(chainId as EvmChainId)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_UNSUPPORTED_CHAIN, `chainId must be one of: ${SUPPORTED_CHAIN_IDS.join(', ')}`),
      { status: 422 },
    )
  }

  if (!address || !evmService.validateAddress(address)) {
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
