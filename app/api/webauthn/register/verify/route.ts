import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { db } from '@/lib/db/mock-db'
import { requireAuth, parseBody } from '@/lib/api/http'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'
const EXPECTED_ORIGIN = process.env.NEXT_PUBLIC_EXPECTED_ORIGIN || 'http://localhost:3000'

const VerifySchema = z.object({
  email: z.string().trim().min(1, 'email is required'),
  response: z.record(z.string(), z.any()),
  expectedChallenge: z.string().min(1, 'expectedChallenge is required'),
})

// Issue #68: requires auth — completes adding a new passkey credential to
// an existing account.
export async function POST(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  const parsed = await parseBody(request, VerifySchema)
  if (!parsed.ok) return parsed.response

  try {
    const { email, response, expectedChallenge } = parsed.data
    const user = await db.getUser(email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
    })

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo
      await db.saveWebAuthnCredential({
        user_id: user.id,
        credential_id: Buffer.from(credential.id).toString('base64url'),
        public_key: Buffer.from(credential.publicKey).toString('base64url'),
        user_handle: user.id,
        transports: response.response.transports,
        counter: credential.counter,
      })

      return NextResponse.json({ verified: true })
    }

    return NextResponse.json({ verified: false, error: 'Verification failed' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to verify registration' }, { status: 500 })
  }
}
