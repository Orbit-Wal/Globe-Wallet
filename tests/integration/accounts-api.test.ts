/**
 * @jest-environment node
 */
import { GET, POST } from '../../app/api/accounts/route'
import { NextRequest } from 'next/server'
import { db } from '../../lib/db/mock-db'
import { TEST_STELLAR_ADDRESS, SECONDARY_STELLAR_ADDRESS } from '../../lib/fixtures'

describe('/api/accounts', () => {
  beforeEach(async () => {
    const accounts = await db.listAccounts()
    const primary = accounts.find((a) => a.isPrimary)!
    await db.setActiveAccount(primary.id)
  })

  it('GET lists accounts and returns the active primary by default', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.accounts.length).toBeGreaterThanOrEqual(2)
    expect(body.data.active.publicKey).toBe(TEST_STELLAR_ADDRESS)
  })

  it('POST switches the active account', async () => {
    const accounts = await db.listAccounts()
    const secondary = accounts.find((a) => a.publicKey === SECONDARY_STELLAR_ADDRESS)!

    const req = new NextRequest('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ accountId: secondary.id }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.active.publicKey).toBe(SECONDARY_STELLAR_ADDRESS)

    const getRes = await GET()
    const getBody = await getRes.json()
    expect(getBody.data.active.publicKey).toBe(SECONDARY_STELLAR_ADDRESS)
  })

  it('POST rejects missing accountId', async () => {
    const req = new NextRequest('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST rejects unknown accountId', async () => {
    const req = new NextRequest('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ accountId: 'does-not-exist' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
