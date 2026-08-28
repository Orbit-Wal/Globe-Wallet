/**
 * lib/api/http.ts
 * Shared helpers applied across every app/api/* route:
 *
 * - Issue #68: `requireAuth` — a single auth-guard used by every route that
 *   should require a caller identity, wrapping the existing
 *   `validateBearerToken` (lib/auth.ts) so all 18 routes enforce it the
 *   same way instead of ad hoc per-file checks.
 * - Issue #67: `parseBody` / `parseQuery` — zod-schema validation of the
 *   request body / query string, with one consistent error shape (422,
 *   `code: 'ERR_VALIDATION'`) instead of per-file ERR_* strings and
 *   hand-rolled `typeof`/regex checks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError, ZodTypeAny } from 'zod'
import { validateBearerToken } from '@/lib/auth'

/** Returns a 401 NextResponse if the request lacks a valid bearer token, otherwise null. */
export function requireAuth(request: NextRequest): NextResponse | null {
  if (!validateBearerToken(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'ERR_UNAUTHORIZED' },
      { status: 401 },
    )
  }
  return null
}

function zodErrorResponse(error: ZodError): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      code: 'ERR_VALIDATION',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    { status: 422 },
  )
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

/** Parses and validates a JSON request body against `schema`. Returns a ready-to-return 400/422 response on failure. */
export async function parseBody<S extends ZodTypeAny>(
  request: NextRequest,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Invalid JSON body', code: 'ERR_INVALID_JSON' },
        { status: 400 },
      ),
    }
  }

  const result = schema.safeParse(json)
  if (!result.success) {
    return { ok: false, response: zodErrorResponse(result.error) }
  }
  return { ok: true, data: result.data }
}

/** Parses and validates the URL's query string against `schema`. Returns a ready-to-return 422 response on failure. */
export function parseQuery<S extends ZodTypeAny>(request: NextRequest, schema: S): ParseResult<z.infer<S>> {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const result = schema.safeParse(params)
  if (!result.success) {
    return { ok: false, response: zodErrorResponse(result.error) }
  }
  return { ok: true, data: result.data }
}
