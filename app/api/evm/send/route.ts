/**
 * POST /api/evm/send
 *
 * Builds, signs, and broadcasts a real native-currency transaction on Base
 * Sepolia / Ethereum Sepolia testnet, mirroring app/api/wallet/send/route.ts
 * for Stellar. MVP scope is native-currency transfers only — ERC-20 sends
 * are follow-up work.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/auth'
import { ErrorCodes, apiError } from '@/lib/errors'
import { evmService } from '@/lib/evm/evm.service'
import { getEvmPaymentService, EvmPaymentConfigError } from '@/lib/evm/evm-payment.service'
import type { EvmChainId, EvmTransactionResult } from '@/lib/types'

const SUPPORTED_CHAIN_IDS: EvmChainId[] = ['base', 'ethereum']

interface SendBody {
  chainId?: string
  destination?: string
  amount?: number
}

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SendBody = {}
  try {
    body = (await request.json()) as SendBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { chainId, destination, amount } = body

  if (!chainId || !SUPPORTED_CHAIN_IDS.includes(chainId as EvmChainId)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_UNSUPPORTED_CHAIN, `chainId must be one of: ${SUPPORTED_CHAIN_IDS.join(', ')}`),
      { status: 422 },
    )
  }

  if (!destination || typeof destination !== 'string') {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'destination is required'),
      { status: 422 },
    )
  }

  if (!evmService.validateAddress(destination)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'not a valid EVM address'),
      { status: 422 },
    )
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_AMOUNT, 'amount must be a positive number'),
      { status: 422 },
    )
  }

  const paymentService = getEvmPaymentService()

  try {
    const submission = await paymentService.submitPayment({
      chainId: chainId as EvmChainId,
      destination,
      amount,
    })

    const result: EvmTransactionResult = {
      success: submission.status !== 'failed',
      hash: submission.hash,
      status: submission.status,
      error: submission.error,
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    if (err instanceof EvmPaymentConfigError) {
      return NextResponse.json(
        apiError(ErrorCodes.ERR_PAYMENT_NOT_CONFIGURED, err.message),
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payment submission failed' },
      { status: 500 },
    )
  }
}
