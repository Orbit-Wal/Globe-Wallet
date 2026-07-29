import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
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

    const credential = await db.getWebAuthnCredentialById(
      Buffer.from(response.id, 'base64url').toString('base64url')
    )
    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: credential.credential_id,
        publicKey: Buffer.from(credential.public_key, 'base64url'),
        counter: credential.counter,
        transports: credential.transports as any,
      },
    })

    if (verification.verified) {
      await db.updateWebAuthnCredentialCounter(
        credential.credential_id,
        verification.authenticationInfo.newCounter
      )
      return NextResponse.json({ verified: true })
    }

    return NextResponse.json({ verified: false, error: 'Verification failed' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to verify authentication' }, { status: 500 })
  }
}
