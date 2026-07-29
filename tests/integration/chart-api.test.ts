/** @jest-environment node */
/**
 * Integration tests for GET /api/analytics (Issue #17).
 * Validates response shape, type constraints, error handling, and stat calculations.
 */

import { NextRequest } from 'next/server'
import { GET } from '../../app/api/analytics/route'
import type { ChartAnalyticsApiResponse, ChartDailyDataPoint } from '../../lib/types'

function buildRequest(period?: string): NextRequest {
  const url = period
    ? `http://localhost/api/analytics?period=${period}`
    : 'http://localhost/api/analytics'
  return new NextRequest(url)
}

describe('GET /api/analytics – success paths (Issue #17)', () => {
  it('returns 200 with success=true and week data by default', async () => {
    const res = await GET(buildRequest())
    expect(res.status).toBe(200)
    const body: ChartAnalyticsApiResponse = await res.json()
    expect(body.success).toBe(true)
    expect(body.data?.period).toBe('week')
  })

  it('returns 7 data points for the week period', async () => {
    const res = await GET(buildRequest('week'))
    const body: ChartAnalyticsApiResponse = await res.json()
    expect(body.data?.points).toHaveLength(7)
  })

  it('each data point satisfies ChartDailyDataPoint shape', async () => {
    const res = await GET(buildRequest('week'))
    const body: ChartAnalyticsApiResponse = await res.json()
    const points = body.data!.points

    points.forEach((p: ChartDailyDataPoint) => {
      expect(typeof p.day).toBe('string')
      expect(p.day).toHaveLength(1)
      expect(typeof p.value).toBe('number')
      expect(p.value).toBeGreaterThanOrEqual(0)
      expect(p.value).toBeLessThanOrEqual(100)
      expect(typeof p.label).toBe('string')
      expect(p.label.length).toBeGreaterThan(0)
    })
  })

  it('computes the correct average (62) for the fixture data', async () => {
    const res = await GET(buildRequest('week'))
    const body: ChartAnalyticsApiResponse = await res.json()
    // [45,75,74,92,35,60,50] → sum=431, /7 ≈ 61.57 → rounded to 62
    expect(body.data?.average).toBe(62)
  })

  it('computes the correct peak (92) for the fixture data', async () => {
    const res = await GET(buildRequest('week'))
    const body: ChartAnalyticsApiResponse = await res.json()
    expect(body.data?.peak).toBe(92)
  })

  it('accepts ?period=month', async () => {
    const res = await GET(buildRequest('month'))
    expect(res.status).toBe(200)
    const body: ChartAnalyticsApiResponse = await res.json()
    expect(body.success).toBe(true)
  })

  it('accepts ?period=year', async () => {
    const res = await GET(buildRequest('year'))
    expect(res.status).toBe(200)
    const body: ChartAnalyticsApiResponse = await res.json()
    expect(body.success).toBe(true)
  })

  it('response body has no error field on success', async () => {
    const res = await GET(buildRequest('week'))
    const body: ChartAnalyticsApiResponse = await res.json()
    expect(body.error).toBeUndefined()
  })
})

describe('GET /api/analytics – error paths (Issue #17)', () => {
  it('returns 400 for an unrecognised period value', async () => {
    const res = await GET(buildRequest('quarterly'))
    expect(res.status).toBe(400)
    const body: ChartAnalyticsApiResponse = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('quarterly')
    expect(body.data).toBeUndefined()
  })

  it('returns 400 for an empty period string', async () => {
    const res = await GET(buildRequest(''))
    expect(res.status).toBe(400)
    const body: ChartAnalyticsApiResponse = await res.json()
    expect(body.success).toBe(false)
  })

  it('error message names the disallowed period', async () => {
    const res = await GET(buildRequest('daily'))
    const body: ChartAnalyticsApiResponse = await res.json()
    expect(body.error).toMatch(/daily/)
    expect(body.error).toMatch(/week \| month \| year/)
  })
})

describe('GET /api/analytics – Content-Type (Issue #17)', () => {
  it('returns JSON content type header', async () => {
    const res = await GET(buildRequest())
    const ct = res.headers.get('content-type') ?? ''
    expect(ct).toContain('application/json')
  })
})
