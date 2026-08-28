/**
 * POST /api/sui/send
 *
 * Builds, signs, and broadcasts a real native SUI transfer on Sui testnet,
 * mirroring app/api/evm/send/route.ts. MVP scope is native SUI transfers
 * only — coin-type (USDC) sends are follow-up work.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/auth'
import { ErrorCodes, apiError } from '@/lib/errors'
import { suiService } from '@/lib/sui/sui.service'
import { getSuiPaymentService, SuiPaymentConfigError } from '@/lib/sui/sui-payment.service'
import type { SuiTransactionResult } from '@/lib/types'

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

  if (!destination || typeof destination !== 'string' || !suiService.validateAddress(destination)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'destination is required and must be a valid Sui address'),
      { status: 422 },
    )
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_AMOUNT, 'amount must be a positive number'),
      { status: 422 },
    )
  }

  const paymentService = getSuiPaymentService()

  try {
    const submission = await paymentService.submitPayment({ destination, amount })

    const result: SuiTransactionResult = {
      success: submission.status !== 'failed',
      digest: submission.digest,
      status: submission.status,
      error: submission.error,
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    if (err instanceof SuiPaymentConfigError) {
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
