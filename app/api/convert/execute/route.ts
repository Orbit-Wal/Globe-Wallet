import { NextRequest, NextResponse } from 'next/server'
import { financeServices } from '@/lib/services/container'
import { ErrorCodes, PaymentQuote, StaleQuoteError, SlippageExceededError } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quote, sourceSecretOrKeypair, destinationAccount } = body as {
      quote: PaymentQuote
      sourceSecretOrKeypair?: string
      destinationAccount?: string
    }

    if (!quote || !quote.executableSourceAmount || !quote.executableDestinationAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `${ErrorCodes.ERR_INVALID_AMOUNT}: Valid payment quote object is required`,
        },
        { status: 400 }
      )
    }

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
