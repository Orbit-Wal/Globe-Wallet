import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { db } from '@/lib/db/mock-db'
import { parseBody } from '@/lib/api/http'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'

const OptionsSchema = z.object({
  email: z.string().trim().min(1, 'email is required'),
})

// Issue #68: intentionally PUBLIC — this is the passkey login flow itself
// (analogous to /api/auth/login); it cannot require a prior session.
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, OptionsSchema)
  if (!parsed.ok) return parsed.response

  try {
    const { email } = parsed.data
    const user = await db.getUser(email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existingCredentials = await db.getWebAuthnCredentialsByUserId(user.id)
    const options = generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: existingCredentials.map(cred => ({
        id: Buffer.from(cred.credential_id, 'base64url'),
        type: 'public-key',
        transports: cred.transports as any,
      })),
      userVerification: 'preferred',
    })

    return NextResponse.json(options)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate authentication options' }, { status: 500 })
  }
}
