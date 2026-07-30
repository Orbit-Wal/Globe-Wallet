import { NextRequest, NextResponse } from 'next/server'
import { financeServices } from '@/lib/services/container'
import { AssetCode, ChangeTrustRequest } from '@/lib/types'
import { validateBearerToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const trustlines = await financeServices.wallet.getTrustlines();
    return NextResponse.json(trustlines, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch trustlines' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as ChangeTrustRequest;
    
    if (!body.asset || !body.action) {
      return NextResponse.json({ error: 'Missing required fields: asset, action' }, { status: 400 })
    }

    if (body.action !== 'add' && body.action !== 'remove') {
      return NextResponse.json({ error: 'Action must be "add" or "remove"' }, { status: 400 })
    }

    const result = await financeServices.wallet.changeTrustline(body.asset, body.action);
    return NextResponse.json({ success: true, data: result }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to change trustline' }, { status: 500 })
  }
}
