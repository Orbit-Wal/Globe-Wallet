import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { financeServices } from '@/lib/services/container'
import { ErrorCodes, PaymentQuote, StaleQuoteError, SlippageExceededError } from '@/lib/types'
import { requireAuth, parseBody } from '@/lib/api/http'

const ExecuteSchema = z.object({
  quote: z
    .object({
      executableSourceAmount: z.union([z.string(), z.number()]),
      executableDestinationAmount: z.union([z.string(), z.number()]),
      expiresAt: z.number(),
    })
    .passthrough(),
  sourceSecretOrKeypair: z.string().optional(),
  destinationAccount: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  const parsed = await parseBody(request, ExecuteSchema)
  if (!parsed.ok) return parsed.response

  try {
    const { sourceSecretOrKeypair, destinationAccount } = parsed.data
    const quote = parsed.data.quote as unknown as PaymentQuote

    // Check staleness
    if (Date.now() > quote.expiresAt) {
      return NextResponse.json(
        {
          success: false,
          error: `${ErrorCodes.ERR_STALE_QUOTE}: Quote has expired. Please request a fresh quote.`,
        },
        { status: 400 }
      )
    }

    const result = await financeServices.pathPayment.executePayment({
      quote,
      sourceSecretOrKeypair,
      destinationAccount,
    })

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error: any) {
    if (error instanceof StaleQuoteError) {
      return NextResponse.json(
        {
          success: false,
          error: `${ErrorCodes.ERR_STALE_QUOTE}: ${error.message}`,
        },
        { status: 400 }
      )
    }

    if (error instanceof SlippageExceededError) {
      return NextResponse.json(
        {
          success: false,
          error: `${ErrorCodes.ERR_SLIPPAGE_EXCEEDED}: ${error.message}`,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: `${ErrorCodes.ERR_LOOKUP_FAILED}: ${error.message || 'Execution failed'}`,
      },
      { status: 500 }
    )
  }
}
