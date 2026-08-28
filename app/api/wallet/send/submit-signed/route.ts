/**
 * POST /api/wallet/send/submit-signed — Issue #92
 *
 * Submits a transaction that was already signed externally (e.g. by a
 * Ledger device via lib/ledger/ledger.service.ts). Counterpart to
 * /api/wallet/send/prepare. This route never sees a private key — only the
 * XDR and the signature the client already produced.
 */

import { NextRequest, NextResponse } from 'next/server'
import { StrKey } from '@stellar/stellar-sdk'
import { type TransactionResult } from '@/lib/types'
import { validateBearerToken } from '@/lib/auth'
import { ErrorCodes, apiError } from '@/lib/errors'
import { getStellarPaymentService, StellarPaymentConfigError } from '@/lib/services/stellar-payment.service'

interface SubmitSignedBody {
  xdr?: string
  publicKey?: string
  signature?: string
  networkPassphrase?: string
}

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SubmitSignedBody = {}
  try {
    body = (await request.json()) as SubmitSignedBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { xdr, publicKey, signature, networkPassphrase } = body

  if (!xdr || typeof xdr !== 'string') {
    return NextResponse.json(apiError(ErrorCodes.ERR_MISSING_XDR, 'xdr is required'), { status: 422 })
  }

  if (!publicKey || !StrKey.isValidEd25519PublicKey(publicKey)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'publicKey is required and must be a valid Stellar public key'),
      { status: 422 },
    )
  }

  if (!signature || typeof signature !== 'string') {
    return NextResponse.json(apiError(ErrorCodes.ERR_MISSING_SIGNATURE, 'signature is required (base64)'), { status: 422 })
  }

  try {
    const submission = await getStellarPaymentService().submitSignedTransaction(
      xdr,
      publicKey,
      signature,
      networkPassphrase,
    )

    const result: TransactionResult = {
      success: submission.status !== 'failed',
      hash: submission.hash,
      status: submission.status,
      error: submission.error,
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    if (err instanceof StellarPaymentConfigError) {
      return NextResponse.json(apiError(ErrorCodes.ERR_PAYMENT_NOT_CONFIGURED, err.message), { status: 503 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to submit transaction' },
      { status: 500 },
    )
  }
}
