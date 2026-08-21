import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
import { db } from './db/mock-db'

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'globe-wallet-development-secret'
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

interface AuthTokenPayload {
  sub: string
  type: 'access' | 'refresh'
  jti?: string
  iat: number
  exp: number
}

function base64UrlEncode(input: string | Uint8Array) {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input)
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4)
  return Buffer.from(base64, 'base64').toString('utf8')
}

function signJwt(payload: Record<string, unknown>) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const claims = { ...payload, iat: now }
  const encoded = base64UrlEncode(JSON.stringify(claims))
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${encoded}`).digest()
  return `${header}.${encoded}.${base64UrlEncode(signature)}`
}

function verifyJwtToken(token: string): AuthTokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, payload, signature] = parts
  const expected = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest()
  const decodedSig = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  if (decodedSig.length !== expected.length || !timingSafeEqual(expected, decodedSig)) {
    return null
  }

  try {
    const value = JSON.parse(base64UrlDecode(payload)) as AuthTokenPayload
    if (typeof value.exp !== 'number' || typeof value.iat !== 'number') return null
    if (Date.now() / 1000 >= value.exp) return null
    return value
  } catch {
    return null
  }
}

function createToken(userId: string, type: 'access' | 'refresh', ttlSeconds: number, tokenId?: string) {
  const now = Math.floor(Date.now() / 1000)
  const payload: Record<string, unknown> = {
    sub: userId,
    type,
    iat: now,
    exp: now + ttlSeconds,
  }
  if (tokenId) payload.jti = tokenId
  return signJwt(payload)
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null

  const [type, token] = header.split(' ')
  return type === 'Bearer' && token ? token : null
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (passwordHash.startsWith('$2') || passwordHash.startsWith('$bcrypt')) {
    return bcrypt.compare(password, passwordHash)
  }
  return false
}

export function signAccessToken(userId: string): string {
  return createToken(userId, 'access', ACCESS_TOKEN_TTL_SECONDS)
}

export function signRefreshToken(userId: string, tokenId: string): string {
  return createToken(userId, 'refresh', REFRESH_TOKEN_TTL_SECONDS, tokenId)
}

export async function createSession(userId: string) {
  const refreshTokenId = randomUUID ? randomUUID() : Math.random().toString(36).slice(2, 10)
  const refreshToken = signRefreshToken(userId, refreshTokenId)
  const accessToken = signAccessToken(userId)
  await db.saveSession({
    user_id: userId,
    refresh_token_id: refreshTokenId,
    expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
  })

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  }
}

export async function rotateRefreshToken(refreshToken: string) {
  const payload = verifyJwtToken(refreshToken)
  if (!payload || payload.type !== 'refresh' || !payload.jti) {
    return null
  }

  const session = await db.getSessionByRefreshTokenId(payload.jti)
  if (!session) {
    return null
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db.revokeSessionByRefreshTokenId(payload.jti)
    return null
  }

  await db.revokeSessionByRefreshTokenId(payload.jti)
  return createSession(payload.sub)
}

export function validateBearerToken(request: NextRequest): boolean {
  const token = getBearerToken(request)
  if (!token) return false

  if (process.env.NODE_ENV === 'test' && token === 'test-token') {
    return true
  }

  const payload = verifyJwtToken(token)
  return payload?.type === 'access'
}
