import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { financeServices } from '@/lib/services/container'
import { ErrorCodes, NoPathFoundError, AssetCode, PathPaymentMode } from '@/lib/types'
import { parseQuery } from '@/lib/api/http'

const QuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  amount: z.coerce.number().positive(),
  mode: z.enum(['strictSend', 'strictReceive']).optional(),
  slippage: z.coerce.number().gt(0).lte(50).optional(),
  destinationAccount: z.string().optional(),
})

// Issue #68: intentionally PUBLIC — a pricing/quote calculation, no wallet
// mutation and no secret material involved.
export async function GET(request: NextRequest) {
  const parsed = parseQuery(request, QuerySchema)
  if (!parsed.ok) return parsed.response
  const { destinationAccount } = parsed.data
  const from = parsed.data.from as AssetCode
  const to = parsed.data.to as AssetCode
  const numAmount = parsed.data.amount
  const mode = (parsed.data.mode || 'strictSend') as PathPaymentMode
  const slippageTolerance = parsed.data.slippage ?? 0.5

  try {
    const quote = await financeServices.pathPayment.findQuote({
      sourceAsset: from,
      destinationAsset: to,
      amount: String(numAmount),
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
