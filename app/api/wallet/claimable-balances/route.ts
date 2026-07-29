import { NextRequest, NextResponse } from 'next/server'
import { financeServices } from '../../../../lib/services/container'
import { validateBearerToken } from '../../../../lib/auth'
import { ErrorCodes, apiError } from '../../../../lib/errors'

export async function GET(request?: NextRequest) {
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { balanceId } = body as { balanceId: string }
    const accountId = body.accountId as string | undefined

    if (!balanceId || typeof balanceId !== 'string') {
      return NextResponse.json(
        apiError(ErrorCodes.ERR_MISSING_QUERY, 'balanceId is required'),
        { status: 422 },
      )
    }

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