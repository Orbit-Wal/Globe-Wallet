import { NextRequest, NextResponse } from 'next/server'
import { financeServices } from '@/lib/services/container'

/**
 * Multi-account API
 * GET  /api/accounts              → list accounts + active
 * POST /api/accounts { accountId } → switch active account
 */
export async function GET() {
  try {
    const accounts = financeServices.wallet.listAccounts()
    const active = financeServices.wallet.getAccountInfo()
    return NextResponse.json({
      success: true,
      data: {
        accounts,
        activeAccountId: active.id ?? financeServices.wallet.getActiveAccountId(),
        active,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const accountId = body?.accountId as string | undefined
    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'accountId is required' },
        { status: 400 },
      )
    }

    const account = financeServices.wallet.switchAccount(accountId)
    return NextResponse.json({
      success: true,
      data: {
        activeAccountId: account.id,
        active: financeServices.wallet.getAccountInfo(account.id),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch account',
      },
      { status: 400 },
    )
  }
}
