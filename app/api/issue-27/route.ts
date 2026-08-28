import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/http'

/**
 * Enterprise analytics and health check endpoint for Issue #27
 * Issue #68: GET is intentionally PUBLIC (health check); POST requires auth.
 */
export async function GET() {
    return NextResponse.json({
        status: 'healthy',
        version: '1.2.0-issue-27',
        services: [
            'wallet',
            'exchange',
            'offRamp',
            'pricing',
            'fiat'
        ],
        timestamp: new Date().toISOString()
    })
}

export async function POST(request: NextRequest) {
    const authError = requireAuth(request)
    if (authError) return authError

    return NextResponse.json({
        verified: true,
        status: 'completed'
    })
}
