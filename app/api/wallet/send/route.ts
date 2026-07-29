import { NextRequest, NextResponse } from 'next/server'
import { StrKey } from '@stellar/stellar-sdk'
import { type TransactionResult } from '@/lib/types'
import { validateBearerToken } from '@/lib/auth'
import { ErrorCodes, apiError } from '@/lib/errors'
import { SUPPORTED_STELLAR_ASSETS } from '@/lib/fixtures'
import { db } from '@/lib/db/mock-db'
import { getStellarPaymentService, StellarPaymentConfigError } from '@/lib/services/stellar-payment.service'
import { context, extractTraceContext, withSpan } from '@/lib/tracing/tracer'

interface SendBody {
  destination?: string
  amount?: number
  asset?: string
  memo?: string
  accountId?: string
}

/** Stellar's MEMO_TEXT operation stores at most 28 bytes. */
const MAX_MEMO_BYTES = 28

export async function POST(request: NextRequest) {
  // Issue #103: continue the caller's trace (from wallet.service.ts's
  // traceparent header) instead of starting a disconnected server-side trace.
  const parentContext = extractTraceContext(request.headers)

  return context.with(parentContext, () =>
    withSpan('api.wallet.send', () => handleSend(request), { 'http.route': '/api/wallet/send' }),
  )
}

async function handleSend(request: NextRequest) {
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SendBody = {}

  try {
    body = (await request.json()) as SendBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { destination, amount, asset, memo, accountId } = body

  if (!destination || typeof destination !== 'string') {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'destination is required'),
      { status: 422 },
    )
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_AMOUNT, 'amount must be a positive number'),
      { status: 422 },
    )
  }

  if (!asset || typeof asset !== 'string') {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_MISSING_ASSET, 'asset is required'),
      { status: 422 },
    )
  }

  // Real checksum validation (StrKey), not just a length/charset regex — a
  // string that merely *looks* like a Stellar key would previously sail
  // through and reach the fabricated-hash code path further down.
  if (!StrKey.isValidEd25519PublicKey(destination)) {
    return NextResponse.json(
      apiError(ErrorCodes.ERR_INVALID_ADDRESS, 'not a valid Stellar public key'),
      { status: 422 },
    )
  }

  if (!SUPPORTED_STELLAR_ASSETS.some((a) => a.code === asset)) {
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

  const paymentService = getStellarPaymentService()

  // This deployment currently signs with a single server-configured account
  // (see STELLAR_SOURCE_SECRET_KEY in .env.example) — there is no per-account
  // custody yet. That's fine for the default/active account, which is what
  // every existing caller uses. But if a caller explicitly names a *different*
  // account (multi-account switcher), silently signing with the wrong key
  // would send real funds from an account the caller never selected — so
  // that specific case is rejected loudly instead of guessed at. Wiring a
  // real per-account signer is tracked as follow-up work (see docs/issue-63.md).
  if (accountId) {
    const signingPublicKey = paymentService.getSigningPublicKey()
    if (signingPublicKey) {
      let account
      try {
        account = await db.resolveAccount(accountId)
      } catch (err) {
        return NextResponse.json(
          apiError(ErrorCodes.ERR_ACCOUNT_KEY_MISMATCH, err instanceof Error ? err.message : 'Unknown wallet account'),
          { status: 422 },
        )
      }
      if (account.publicKey !== signingPublicKey) {
        return NextResponse.json(
          apiError(
            ErrorCodes.ERR_ACCOUNT_KEY_MISMATCH,
            `The configured signing key does not control account ${account.publicKey}. ` +
              'This deployment can only submit real payments for the account matching STELLAR_SOURCE_SECRET_KEY.',
          ),
          { status: 409 },
        )
      }
    }
  }

  try {
    const submission = await paymentService.submitPayment({ destination, amount, asset, memo })

    // "success" covers both a confirmed ledger write and a broadcast we
    // couldn't yet confirm (pending) — only a definitive rejection is a
    // failure. The UI distinguishes pending from completed via `status`.
    const result: TransactionResult = {
      success: submission.status !== 'failed',
      hash: submission.hash,
      status: submission.status,
      error: submission.error,
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    if (err instanceof StellarPaymentConfigError) {
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
