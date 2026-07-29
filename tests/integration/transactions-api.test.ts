/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '../../app/api/transactions/route'
import { GET as GET_SYNC, POST as POST_SYNC } from '../../app/api/transactions/sync/route'

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init)
}

describe('GET /api/transactions', () => {
  it('returns 200 with success:true and a paginated page object', async () => {
    const req = makeRequest('http://localhost/api/transactions?paginate=true&limit=10')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toHaveProperty('data')
    expect(json.data).toHaveProperty('total')
    expect(json.data).toHaveProperty('offset')
    expect(json.data).toHaveProperty('limit')
    expect(json.data).toHaveProperty('hasMore')
  })

  it('respects limit parameter', async () => {
    const req = makeRequest('http://localhost/api/transactions?paginate=true&limit=1')
    const res = await GET(req)
    const json = await res.json()
    expect(json.data.data.length).toBeLessThanOrEqual(1)
    expect(json.data.limit).toBe(1)
  })

  it('returns flat array when paginate=false', async () => {
    const req = makeRequest('http://localhost/api/transactions?paginate=false')
    const res = await GET(req)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  it('filters by type=in (only receive/in types returned)', async () => {
    const req = makeRequest('http://localhost/api/transactions?paginate=true&type=in')
    const res = await GET(req)
    const json = await res.json()
    const txs: Array<{ type: string }> = json.data.data
    if (txs.length > 0) {
      expect(txs.every(t => t.type === 'receive' || t.type === 'in')).toBe(true)
    }
  })

  it('search returns empty set for unknown query', async () => {
    const req = makeRequest('http://localhost/api/transactions?paginate=true&search=nonexistentquery_xyz')
    const res = await GET(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.data).toHaveLength(0)
    expect(json.data.total).toBe(0)
  })

  it('clamps limit to max 100', async () => {
    const req = makeRequest('http://localhost/api/transactions?paginate=true&limit=999')
    const res = await GET(req)
    const json = await res.json()
    expect(json.data.limit).toBe(100)
  })

  it('offset paginates correctly', async () => {
    const first = await (await GET(makeRequest('http://localhost/api/transactions?paginate=true&limit=1&offset=0'))).json()
    const second = await (await GET(makeRequest('http://localhost/api/transactions?paginate=true&limit=1&offset=1'))).json()
    if (first.data.total >= 2) {
      expect(first.data.data[0]?.id).not.toBe(second.data.data[0]?.id)
    }
  })
})

describe('POST /api/transactions', () => {
  it('creates a transaction and returns 201', async () => {
    const req = makeRequest('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'receive',
        amount: 50,
        asset: 'XLM',
        address: 'GTESTINTEGRATION',
        name: 'Integration Test Deposit',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data[0].id).toMatch(/^tx_/)
    expect(json.data[0].status).toBe('pending')
    expect(json.data[0].amount).toBe(50)
  })

  it('returns 400 for missing required fields', async () => {
    const req = makeRequest('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 10 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/Missing required fields/)
  })

  it('returns 400 for non-positive amount', async () => {
    const req = makeRequest('http://localhost/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'send', amount: -5, asset: 'XLM', address: 'GTEST' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('GET /api/transactions/sync', () => {
  it('returns sync status with 200', async () => {
    const res = await GET_SYNC()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toMatchObject({
      isSyncing: expect.any(Boolean),
      totalSynced: expect.any(Number),
    })
  })
})

describe('POST /api/transactions/sync', () => {
  it('triggers a sync and returns result shape', async () => {
    const req = new NextRequest('http://localhost:3000/api/transactions/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer mock-token' },
    })
    const res = await POST_SYNC(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toMatchObject({
      added: expect.any(Number),
      updated: expect.any(Number),
      failed: expect.any(Number),
      lastSyncAt: expect.any(String),
    })
  })

  it('added is non-negative', async () => {
    const req = new NextRequest('http://localhost:3000/api/transactions/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer mock-token' },
    })
    const res = await POST_SYNC(req)
    const json = await res.json()
    expect(json.data.added).toBeGreaterThanOrEqual(0)
  })
})
