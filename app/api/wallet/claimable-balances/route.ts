import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { financeServices } from '../../../../lib/services/container'
import { requireAuth, parseBody } from '@/lib/api/http'

const ClaimSchema = z.object({
  balanceId: z.string().min(1, 'balanceId is required'),
  accountId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  try {
    const accountId = request?.nextUrl.searchParams.get('accountId') ?? undefined
    
    const balances = await financeServices.wallet.listClaimableBalances(accountId)
    
    const totalAmount = balances.reduce((sum, b) => sum + b.amount, 0)

    return NextResponse.json({
      success: true,
      data: {
        balances,
        totalAmount,
        count: balances.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to list claimable balances' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  const parsed = await parseBody(request, ClaimSchema)
  if (!parsed.ok) return parsed.response

  try {
    const { balanceId, accountId } = parsed.data
    const result = await financeServices.wallet.claimBalance(balanceId, accountId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to claim balance' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        balanceId,
        hash: result.hash,
        status: result.status,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to claim balance' },
      { status: 500 }
    )
  }
}