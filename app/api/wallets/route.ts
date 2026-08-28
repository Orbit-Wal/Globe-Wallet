import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { financeServices } from '../../../lib/services/container'
import { requireAuth, parseBody } from '@/lib/api/http'

const ConvertSchema = z.object({
  from: z.string().min(1, 'from is required'),
  to: z.string().min(1, 'to is required'),
  amount: z.coerce.number().nonnegative('amount must be a non-negative number'),
})

// Issue #68: requires auth — exposes this account's fiat wallet balances.
export async function GET(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  try {
    const wallets = financeServices.fiat.getWallets()
    return NextResponse.json({ success: true, data: wallets })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  const parsed = await parseBody(request, ConvertSchema)
  if (!parsed.ok) return parsed.response

  try {
    const { from, to, amount } = parsed.data
    const converted = financeServices.fiat.convertCurrency(from, to, amount)
    const rate = amount > 0 ? converted / amount : financeServices.fiat.convertCurrency(from, to, 1)
    
    return NextResponse.json({ 
      success: true, 
      data: { 
        from, 
        to, 
        originalAmount: amount, 
        convertedAmount: converted, 
        rate 
      } 
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Invalid conversion' },
      { status: 400 }
    )
  }
}