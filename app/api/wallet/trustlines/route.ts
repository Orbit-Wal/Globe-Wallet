import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { financeServices } from '@/lib/services/container'
import { AssetCode, ChangeTrustRequest } from '@/lib/types'
import { requireAuth, parseBody } from '@/lib/api/http'

const ChangeTrustSchema = z.object({
  asset: z.string().min(1, 'asset is required'),
  action: z.enum(['add', 'remove'], { errorMap: () => ({ message: 'Action must be "add" or "remove"' }) }),
})

export async function GET(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  try {
    const trustlines = await financeServices.wallet.getTrustlines();
    return NextResponse.json(trustlines, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch trustlines' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  const parsed = await parseBody(request, ChangeTrustSchema)
  if (!parsed.ok) return parsed.response

  try {
    const body = parsed.data as ChangeTrustRequest
    const result = await financeServices.wallet.changeTrustline(body.asset, body.action);
    return NextResponse.json({ success: true, data: result }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to change trustline' }, { status: 500 })
  }
}
