import { NextRequest, NextResponse } from 'next/server'
import { financeServices } from '@/lib/services/container'
import { ErrorCodes, NoPathFoundError, AssetCode, PathPaymentMode } from '@/lib/types'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const from = searchParams.get('from') as AssetCode
  const to = searchParams.get('to') as AssetCode
  const amount = searchParams.get('amount')
  const mode = (searchParams.get('mode') || 'strictSend') as PathPaymentMode
  const slippageStr = searchParams.get('slippage')
  const destinationAccount = searchParams.get('destinationAccount') || undefined

  if (!from || !to || !amount) {
    return NextResponse.json(
      {
        success: false,
        error: `${ErrorCodes.ERR_INVALID_AMOUNT}: Required parameters missing (from, to, amount)`,
      },
      { status: 400 }
    )
  }

  const numAmount = parseFloat(amount)
  if (isNaN(numAmount) || numAmount <= 0) {
    return NextResponse.json(
      {
        success: false,
        error: `${ErrorCodes.ERR_INVALID_AMOUNT}: Amount must be a positive number`,
      },
      { status: 400 }
    )
  }

  const slippageTolerance = slippageStr ? parseFloat(slippageStr) : 0.5
  if (isNaN(slippageTolerance) || slippageTolerance <= 0 || slippageTolerance > 50) {
    return NextResponse.json(
      {
        success: false,
        error: `${ErrorCodes.ERR_SLIPPAGE_EXCEEDED}: Slippage tolerance must be between 0.01% and 50%`,
      },
      { status: 400 }
    )
  }

  try {
    const quote = await financeServices.pathPayment.findQuote({
      sourceAsset: from,
      destinationAsset: to,
      amount,
      mode,
      slippageTolerance,
      destinationAccount,
    })

    return NextResponse.json({
      success: true,
      quote,
    })
  } catch (error: any) {
    if (error instanceof NoPathFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: `${ErrorCodes.ERR_NO_PATH_FOUND}: ${error.message}`,
        },
        { status: 404 }
      )
    }

    const isNetworkErr = error.message?.toLowerCase().includes('network') || error.message?.toLowerCase().includes('fetch')
    const statusCode = isNetworkErr ? 503 : 500
    const errCode = isNetworkErr ? ErrorCodes.ERR_NETWORK_FAILURE : ErrorCodes.ERR_LOOKUP_FAILED

    return NextResponse.json(
      {
        success: false,
        error: `${errCode}: ${error.message || 'Failed to fetch path payment quote'}`,
      },
      { status: statusCode }
    )
  }
}
