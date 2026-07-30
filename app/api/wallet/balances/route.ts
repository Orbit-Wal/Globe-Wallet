import { NextRequest, NextResponse } from 'next/server'
import { FixtureFactory } from '@/lib/fixtures'
import { validateBearerToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(FixtureFactory.getBalances(), { status: 200 })
}
