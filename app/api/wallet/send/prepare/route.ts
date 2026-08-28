/**
 * POST /api/wallet/send/prepare — Issue #92
 *
 * Builds (but does not sign) a Stellar payment transaction for an arbitrary
 * source account. Counterpart to /api/wallet/send/submit-signed. Together
 * these two routes are the external-signer path (Ledger today): the private
 * key never touches this server, so signing happens client-side against the
 * XDR/signatureBase returned here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { StrKey } from '@stellar/stellar-sdk'
import { validateBearerToken } from '@/lib/auth'
import { ErrorCodes, apiError } from '@/lib/errors'
import { SUPPORTED_STELLAR_ASSETS } from '@/lib/fixtures'
import { getStellarPaymentService, StellarPaymentConfigError } from '@/lib/services/stellar-payment.service'

interface PrepareBody {
  sourcePublicKey?: string
  destination?: string
  amount?: number
  asset?: string
  memo?: string
}

const MAX_MEMO_BYTES = 28

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: PrepareBody = {}
  try {
    body = (await request.json()) as PrepareBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { sourcePublicKey, destination, amount, asset, memo } = body

  if (!sourcePublicKey || !StrKey.isValidEd25519PublicKey(sourcePublicKey)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'sourcePublicKey is required and must be a valid Stellar public key'),
      { status: 422 },
    )
  }

  if (!destination || !StrKey.isValidEd25519PublicKey(destination)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'destination is required and must be a valid Stellar public key'),
      { status: 422 },
    )
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_AMOUNT, 'amount must be a positive number'),
      { status: 422 },
    )
  }

  if (!asset || !SUPPORTED_STELLAR_ASSETS.some((a) => a.code === asset)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_UNSUPPORTED_ASSET, `asset must be one of: ${SUPPORTED_STELLAR_ASSETS.map((a) => a.code).join(', ')}`),
      { status: 422 },
    )
  }

  if (memo && Buffer.byteLength(memo, 'utf8') > MAX_MEMO_BYTES) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_MEMO_TOO_LONG, `memo must be at most ${MAX_MEMO_BYTES} bytes`),
      { status: 422 },
    )
  }

  try {
    const prepared = await getStellarPaymentService().buildUnsignedTransaction({
      sourcePublicKey,
      destination,
      amount,
      asset,
      memo,
    })
    return NextResponse.json(prepared, { status: 200 })
  } catch (err) {
    if (err instanceof StellarPaymentConfigError) {
      return NextResponse.json(apiError(ErrorCodes.ERR_PAYMENT_NOT_CONFIGURED, err.message), { status: 503 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build transaction' },
      { status: 500 },
    )
  }
}
