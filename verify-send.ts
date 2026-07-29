/**
 * Manual verification script for Issue #63 — proves app/api/wallet/send/route.ts
 * performs a REAL Horizon submission (build, sign, submit) against Stellar
 * testnet, with no mocking. Run with:
 *
 *   STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org \
 *   NEXT_PUBLIC_STELLAR_NETWORK=testnet \
 *   STELLAR_SOURCE_SECRET_KEY=<funded testnet secret> \
 *   npx tsx verify-send.ts <destinationPublicKey>
 *
 * Mirrors the style of verify.ts (Issue #a0c0d9c, real Horizon polling).
 * Not part of the app; not imported by anything. Safe to delete after review.
 */
import { NextRequest } from 'next/server'
import { POST as sendPOST } from './app/api/wallet/send/route'

async function send(destination: string, amount: number, memo?: string) {
  const request = new NextRequest('http://localhost/api/wallet/send', {
    method: 'POST',
    headers: { Authorization: 'Bearer verify-script', 'Content-Type': 'application/json' },
    body: JSON.stringify({ destination, amount, asset: 'XLM', memo }),
  })
  const response = await sendPOST(request)
  const body = await response.json()
  return { httpStatus: response.status, body }
}

async function run() {
  const destination = process.argv[2]
  if (!destination) {
    console.error('Usage: npx tsx verify-send.ts <destinationPublicKey> [badDestinationPublicKey]')
    process.exit(1)
  }

  console.log('--- Case 1: real payment, should complete ---')
  const ok = await send(destination, 1.5, 'issue-63 verify')
  console.log(JSON.stringify(ok, null, 2))

  console.log('\n--- Case 2: overdraw the source account, should fail (real Horizon rejection) ---')
  const overdrawn = await send(destination, 999999999)
  console.log(JSON.stringify(overdrawn, null, 2))

  const badDestination = process.argv[3]
  if (badDestination) {
    console.log('\n--- Case 3: destination account does not exist, should fail ---')
    const noDest = await send(badDestination, 1)
    console.log(JSON.stringify(noDest, null, 2))
  }

  console.log('\nDone. Verify each hash independently at:')
  console.log(`  https://stellar.expert/explorer/testnet/tx/${ok.body.hash}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
