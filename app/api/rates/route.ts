import { NextResponse } from 'next/server'
import { FixtureFactory } from '@/lib/fixtures'

// Issue #68: intentionally PUBLIC — general market exchange rates, not
// tied to any user or wallet.
export async function GET() {
  const rates = FixtureFactory.getSimpleRates()
  return NextResponse.json(
    {
      rates,
      updatedAt: new Date().toISOString(),
    },
    { status: 200 },
  )
}
