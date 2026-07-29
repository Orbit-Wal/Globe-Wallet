import { NextRequest, NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { db } from '@/lib/db/mock-db'

const RP_NAME = 'Globe Wallet'
const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
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
