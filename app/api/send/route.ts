import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { financeServices } from '../../../lib/services/container'
import { SendRequest, SendResponse } from '../../../lib/types'
import { requireAuth, parseBody } from '@/lib/api/http'

const SendSchema = z.object({
  destination: z.string().min(1, 'destination is required'),
  amount: z.coerce.number().positive('amount must be a positive number'),
  asset: z.string().min(1, 'asset is required'),
  memo: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  const parsed = await parseBody(request, SendSchema)
  if (!parsed.ok) return parsed.response

  try {
    const { destination, amount, asset, memo } = parsed.data as SendRequest

    if (!financeServices.wallet.validateAddress(destination)) {
      return NextResponse.json<SendResponse>(
        { success: false, error: 'Invalid Stellar destination address' },
        { status: 422 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json<SendResponse>(
        { success: false, error: 'Amount must be greater than zero' },
        { status: 422 }
      )
    }

    const result = await financeServices.wallet.sendPayment(destination, amount, asset, memo)
    return NextResponse.json<SendResponse>({
      success: result.success,
      hash: result.hash,
      status: result.status,
    })
  } catch (error) {
    return NextResponse.json<SendResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
