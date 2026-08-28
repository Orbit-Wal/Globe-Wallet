import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rotateRefreshToken } from '@/lib/auth'
import { parseBody } from '@/lib/api/http'

const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

// Issue #68: intentionally PUBLIC — authenticated by the refresh token
// itself, not a bearer access token (that's the whole point of refresh).
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, RefreshSchema)
  if (!parsed.ok) return parsed.response

  const nextSession = await rotateRefreshToken(parsed.data.refreshToken)
  if (!nextSession) {
    return NextResponse.json({ success: false, error: 'Invalid or expired refresh token' }, { status: 401 })
  }

  return NextResponse.json({ success: true, data: nextSession }, { status: 200 })
}
