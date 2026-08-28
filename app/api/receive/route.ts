import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { financeServices } from '../../../lib/services/container'
import { ReceiveService } from '../../../lib/services/receive.service'
import {
  PaymentRequestPayload,
  PaymentRequestResponse,
  ReceiveAddressResponse,
} from '../../../lib/types'
import { requireAuth, parseBody } from '@/lib/api/http'

const receiveService = new ReceiveService(financeServices.wallet)

const PaymentRequestSchema = z.object({
  amount: z.union([z.string(), z.number()]).optional(),
  asset: z.string().optional(),
  memo: z.string().optional(),
}).passthrough()

// Issue #68: requires auth — exposes this account's receive address.
export async function GET(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  try {
    const result = receiveService.getReceiveAddress()
    const status = result.success ? 200 : 422
    return NextResponse.json<ReceiveAddressResponse>(result, { status })
  } catch (error) {
    return NextResponse.json<ReceiveAddressResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  const parsed = await parseBody(request, PaymentRequestSchema)
  if (!parsed.ok) return parsed.response

  try {
    const body = parsed.data as unknown as PaymentRequestPayload
    const result = receiveService.createPaymentRequest(body)

    if (!result.success) {
      return NextResponse.json<PaymentRequestResponse>(result, { status: 422 })
    }

    return NextResponse.json<PaymentRequestResponse>(result)
  } catch (error) {
    return NextResponse.json<PaymentRequestResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
