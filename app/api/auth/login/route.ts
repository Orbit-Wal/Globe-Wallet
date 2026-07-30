import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/mock-db'
import { verifyPassword, createSession } from '@/lib/auth'

interface LoginBody {
  email?: unknown
  password?: unknown
}

export async function POST(request: NextRequest) {
  let body: LoginBody

  try {
    body = (await request.json()) as LoginBody
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json(
      { success: false, error: 'Email and password are required' },
      { status: 422 },
    )
  }

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
