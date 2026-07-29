import { NextRequest, NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { db } from '@/lib/db/mock-db'

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'
const EXPECTED_ORIGIN = process.env.NEXT_PUBLIC_EXPECTED_ORIGIN || 'http://localhost:3000'

export async function POST(request: NextRequest) {
  try {
    const { email, response, expectedChallenge } = await request.json()
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
