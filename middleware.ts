import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'

// --- RATE LIMIT CONFIGURATION ---
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitCache = new Map<string, RateLimitRecord>();

const ROUTE_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  '/api/wallet/send': { windowMs: 60 * 1000, maxRequests: 5 },
  '/api/federation': { windowMs: 60 * 1000, maxRequests: 20 },
  '/api/rates': { windowMs: 60 * 1000, maxRequests: 60 },
}

// --- CORS CONFIGURATION ---
const allowedOrigins = [
  'http://localhost:3000',
]

// --- I18N MIDDLEWARE ---
const intlMiddleware = createMiddleware({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
})

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip i18n for /api routes
  if (pathname.startsWith('/api')) {
    // 1. RATE LIMITING ENFORCEMENT
    if (ROUTE_LIMITS[pathname]) {
      const { windowMs, maxRequests } = ROUTE_LIMITS[pathname];
      const ip = request.headers.get('x-forwarded-for') || request.ip || 'anonymous';
      const cacheKey = `${pathname}:${ip}`;
      
      const now = Date.now();
      const currentRecord = rateLimitCache.get(cacheKey);

      if (!currentRecord || now > currentRecord.resetTime) {
        rateLimitCache.set(cacheKey, {
          count: 1,
          resetTime: now + windowMs,
        });
      } else {
        currentRecord.count += 1;

        if (currentRecord.count > maxRequests) {
          const secondsLeft = Math.ceil((currentRecord.resetTime - now) / 1000);
          
          return new NextResponse(
            JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded.' }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': secondsLeft.toString(),
                'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
              },
            }
          );
        }
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

  // Handle i18n for non-api routes
  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)', '/api/:path*'],
}
