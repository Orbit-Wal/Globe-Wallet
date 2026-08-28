import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { financeServices } from '../../../lib/services/container'
import { parseBody } from '@/lib/api/http'

const AssetPriceSchema = z.object({
  assetCode: z.string().min(1, 'assetCode is required'),
})

// Issue #68: intentionally PUBLIC — general reference asset list, not
// user- or wallet-specific.
export async function GET() {
  try {
    const assets = financeServices.pricing.getAssets()
    return NextResponse.json({ success: true, data: assets })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Issue #68: intentionally PUBLIC — public market price lookup by asset code.
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, AssetPriceSchema)
  if (!parsed.ok) return parsed.response

  try {
    const { assetCode } = parsed.data
    const price = await financeServices.pricing.getPrice(assetCode)
    return NextResponse.json({ success: true, data: { assetCode, price } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Invalid asset code' },
      { status: 400 }
    )
  }
}