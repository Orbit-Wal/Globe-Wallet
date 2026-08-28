import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { db } from '@/lib/db/mock-db'
import { requireAuth, parseBody } from '@/lib/api/http'

const RP_NAME = 'Globe Wallet'
const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'

const OptionsSchema = z.object({
  email: z.string().trim().min(1, 'email is required'),
})

// Issue #68: requires auth — this adds a new passkey credential to an
// existing account and must not be reachable by an unauthenticated caller.
export async function POST(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  const parsed = await parseBody(request, OptionsSchema)
  if (!parsed.ok) return parsed.response

  try {
    const { email } = parsed.data
    const user = await db.getUser(email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existingCredentials = await db.getWebAuthnCredentialsByUserId(user.id)
    const options = generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.email,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map(cred => ({
        id: Buffer.from(cred.credential_id, 'base64url'),
        type: 'public-key',
        transports: cred.transports as any,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    return NextResponse.json(options)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate registration options' }, { status: 500 })
  }
}
