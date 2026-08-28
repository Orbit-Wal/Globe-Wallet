/**
 * POST /api/solana/send
 *
 * Builds, signs, and broadcasts a real native SOL transfer on Solana devnet,
 * mirroring app/api/evm/send/route.ts. MVP scope is native SOL transfers
 * only — SPL-token (USDC) sends are follow-up work.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/auth'
import { ErrorCodes, apiError } from '@/lib/errors'
import { solanaService } from '@/lib/solana/solana.service'
import { getSolanaPaymentService, SolanaPaymentConfigError } from '@/lib/solana/solana-payment.service'
import type { SolanaTransactionResult } from '@/lib/types'

interface SendBody {
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

  const { destination, amount } = body

  if (!destination || typeof destination !== 'string' || !solanaService.validateAddress(destination)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'destination is required and must be a valid Solana address'),
      { status: 422 },
    )
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_AMOUNT, 'amount must be a positive number'),
      { status: 422 },
    )
  }

  const paymentService = getSolanaPaymentService()

  try {
    const submission = await paymentService.submitPayment({ destination, amount })

    const result: SolanaTransactionResult = {
      success: submission.status !== 'failed',
      signature: submission.signature,
      status: submission.status,
      error: submission.error,
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    if (err instanceof SolanaPaymentConfigError) {
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
