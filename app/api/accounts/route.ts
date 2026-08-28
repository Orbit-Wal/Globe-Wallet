import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { financeServices } from '@/lib/services/container'
import { requireAuth, parseBody } from '@/lib/api/http'

const SwitchAccountSchema = z.object({
  accountId: z.string().min(1, 'accountId is required'),
})

/**
 * Multi-account API
 * GET  /api/accounts              → list accounts + active
 * POST /api/accounts { accountId } → switch active account
 * Issue #68: requires auth — exposes wallet account data.
 */
export async function GET(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

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
  const authError = requireAuth(request)
  if (authError) return authError

  const parsed = await parseBody(request, SwitchAccountSchema)
  if (!parsed.ok) return parsed.response

  try {
    const { accountId } = parsed.data
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
