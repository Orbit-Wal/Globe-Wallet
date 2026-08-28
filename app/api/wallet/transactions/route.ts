import { NextRequest, NextResponse } from 'next/server'
import { FixtureFactory } from '@/lib/fixtures'
import { requireAuth } from '@/lib/api/http'

export async function GET(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  return NextResponse.json(FixtureFactory.getTransactions(), { status: 200 })
}
