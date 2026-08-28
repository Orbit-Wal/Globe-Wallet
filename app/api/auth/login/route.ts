import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/mock-db'
import { verifyPassword, createSession } from '@/lib/auth'
import { parseBody } from '@/lib/api/http'

const LoginSchema = z.object({
  email: z.string().trim().min(1, 'email is required'),
  password: z.string().min(1, 'password is required'),
})

// Issue #68: intentionally PUBLIC — this route establishes a session; it
// cannot itself require one.
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, LoginSchema)
  if (!parsed.ok) return parsed.response

  const email = parsed.data.email.toLowerCase()
  const password = parsed.data.password

  const user = await db.getUser(email)
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 },
    )
  }

  const isPasswordValid = await verifyPassword(password, user.password_hash)
  if (!isPasswordValid) {
    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 },
    )
  }

  const session = await createSession(user.id)
  return NextResponse.json(
    {
      success: true,
      data: {
        userId: user.id,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
    },
    { status: 200 },
  )
}
