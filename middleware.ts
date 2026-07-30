import { NextRequest, NextResponse } from 'next/server'

// --- RATE LIMIT CONFIGURATION ---
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitCache = new Map<string, RateLimitRecord>();

const ROUTE_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  '/api/wallet/send': { windowMs: 60 * 1000, maxRequests: 5 },    // Costly mutation
  '/api/federation': { windowMs: 60 * 1000, maxRequests: 20 },   // Intermediate cost lookup
  '/api/rates': { windowMs: 60 * 1000, maxRequests: 60 },        // Standard lookup
}

const protectedPaths = ['/api/off-ramp', '/api/transactions/sync', '/api/transactions']

function requiresAuthentication(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/wallet/')) {
    return true
  }

  if (protectedPaths.includes(pathname)) {
    return pathname === '/api/transactions' ? method.toUpperCase() === 'POST' : true
  }

  return false
}

function base64UrlToUint8Array(base64Url: string) {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), '=')
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    buffer[i] = raw.charCodeAt(i)
  }
  return buffer
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null

  const [type, token] = header.split(' ')
  return type === 'Bearer' && token ? token : null
}

async function verifyAccessToken(token: string): Promise<boolean> {
  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [header, payload, signature] = parts
  const secret = process.env.AUTH_JWT_SECRET ?? 'globe-wallet-development-secret'
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const message = new TextEncoder().encode(`${header}.${payload}`)
  const signatureBytes = base64UrlToUint8Array(signature)
  const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, message)
  if (!isValid) return false

  try {
    const payloadJson = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(payload)))
    if (payloadJson.type !== 'access') return false
    if (typeof payloadJson.exp !== 'number') return false
    return Date.now() / 1000 < payloadJson.exp
  } catch {
    return false
  }
}

// --- CORS CONFIGURATION ---
const allowedOrigins = [
  'http://localhost:3000',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. RATE LIMITING ENFORCEMENT
  if (ROUTE_LIMITS[pathname]) {
    const { windowMs, maxRequests } = ROUTE_LIMITS[pathname]
    const ip = request.headers.get('x-forwarded-for') || 'anonymous'
    const cacheKey = `${pathname}:${ip}`

    const now = Date.now()
    const currentRecord = rateLimitCache.get(cacheKey)

    if (!currentRecord || now > currentRecord.resetTime) {
      rateLimitCache.set(cacheKey, {
        count: 1,
        resetTime: now + windowMs,
      })
    } else {
      currentRecord.count += 1

      if (currentRecord.count > maxRequests) {
        const secondsLeft = Math.ceil((currentRecord.resetTime - now) / 1000)

        return new NextResponse(
          JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': secondsLeft.toString(),
              'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
            },
          },
        )
      }
    }
  }

  // 1.5. AUTHENTICATION GATING
  if (requiresAuthentication(pathname, request.method)) {
    const token = getBearerToken(request)
    if (!token || !(await verifyAccessToken(token))) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer',
          },
        },
      )
    }
  }

  // 2. EXISTING CORS LOGIC
  const origin = request.headers.get('origin') ?? ''
  const isAllowedOrigin = allowedOrigins.includes(origin) || origin === ''

  const response = NextResponse.next()

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  } else {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0])
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    })
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}
