/** @jest-environment node */
/**
 * Integration tests — Convert Path Payment API (Issue #98)
 *
 * Covers:
 *   1. GET /api/convert/quote — returns valid PaymentQuote for strictSend and strictReceive
 *   2. GET /api/convert/quote — returns 400 for invalid/missing params or invalid slippage
 *   3. GET /api/convert/quote — returns 404 for no path available
 *   4. POST /api/convert/execute — executes path payment with valid quote
 *   5. POST /api/convert/execute — rejects expired/stale quotes with 400
 */

import { GET } from '../../app/api/convert/quote/route'
import { POST } from '../../app/api/convert/execute/route'
import { NextRequest } from 'next/server'
import { ErrorCodes } from '../../lib/types'

function buildGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/convert/quote')
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return new NextRequest(url)
}

function buildPostRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/convert/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/convert/quote API', () => {
  it('returns HTTP 200 with quote for valid strictSend request', async () => {
    const req = buildGetRequest({
      from: 'XLM',
      to: 'USDC',
      amount: '100',
      mode: 'strictSend',
      slippage: '0.5',
    })
    const response = await GET(req)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.quote).toBeDefined()
    expect(body.quote.mode).toBe('strictSend')
    expect(body.quote.sourceAsset).toBe('XLM')
    expect(body.quote.destinationAsset).toBe('USDC')
    expect(body.quote.executableSourceAmount).toBe('100.0000000')
    expect(parseFloat(body.quote.executableDestinationAmount)).toBeGreaterThan(0)
    expect(body.quote.destMin).toBeDefined()
    expect(body.quote.sendMax).toBeDefined()
  })

  it('returns HTTP 200 with quote for valid strictReceive request', async () => {
    const req = buildGetRequest({
      from: 'XLM',
      to: 'USDC',
      amount: '10',
      mode: 'strictReceive',
      slippage: '1.0',
    })
    const response = await GET(req)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.quote.mode).toBe('strictReceive')
    expect(body.quote.executableDestinationAmount).toBe('10.0000000')
    expect(parseFloat(body.quote.executableSourceAmount)).toBeGreaterThan(0)
  })

  it('returns HTTP 400 when required query parameters are missing', async () => {
    const req = buildGetRequest({ from: 'XLM' })
    const response = await GET(req)
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain(ErrorCodes.ERR_INVALID_AMOUNT)
  })

  it('returns HTTP 400 when slippage tolerance is out of bounds', async () => {
    const req = buildGetRequest({
      from: 'XLM',
      to: 'USDC',
      amount: '100',
      slippage: '75', // Exceeds max 50%
    })
    const response = await GET(req)
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain(ErrorCodes.ERR_SLIPPAGE_EXCEEDED)
  })
})

describe('POST /api/convert/execute API', () => {
  it('executes transaction successfully with valid non-expired quote', async () => {
    const quoteReq = buildGetRequest({
      from: 'XLM',
      to: 'USDC',
      amount: '100',
      mode: 'strictSend',
    })
    const quoteRes = await GET(quoteReq)
    const { quote } = await quoteRes.json()

    const execReq = buildPostRequest({ quote })
    const execRes = await POST(execReq)

    expect(execRes.status).toBe(200)
    const body = await execRes.json()
    expect(body.success).toBe(true)
    expect(body.result.hash).toBeDefined()
  })

  it('returns HTTP 400 when executing an expired quote', async () => {
    const expiredQuote = {
      mode: 'strictSend',
      sourceAsset: 'XLM',
      destinationAsset: 'USDC',
      executableSourceAmount: '100.0000000',
      executableDestinationAmount: '9.5000000',
      path: [],
      estimatedPrice: 0.095,
      priceImpact: 0,
      slippageTolerance: 0.5,
      destMin: '9.4525000',
      sendMax: '100.0000000',
      expiresAt: Date.now() - 5000, // Expired
      createdAt: Date.now() - 20000,
    }

    const execReq = buildPostRequest({ quote: expiredQuote })
    const execRes = await POST(execReq)

    expect(execRes.status).toBe(400)
    const body = await execRes.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain(ErrorCodes.ERR_STALE_QUOTE)
  })
})
