import { NextRequest, NextResponse } from 'next/server'
import { rotateRefreshToken } from '@/lib/auth'

interface RefreshBody {
  refreshToken?: unknown
}

export async function POST(request: NextRequest) {
  let body: RefreshBody

  try {
    body = (await request.json()) as RefreshBody
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : ''
  if (!refreshToken) {
    return NextResponse.json({ success: false, error: 'Refresh token is required' }, { status: 422 })
  }

  const nextSession = await rotateRefreshToken(refreshToken)
  if (!nextSession) {
    return NextResponse.json({ success: false, error: 'Invalid or expired refresh token' }, { status: 401 })
  }

  return NextResponse.json({ success: true, data: nextSession }, { status: 200 })
}
