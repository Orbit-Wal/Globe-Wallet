/** @jest-environment node */
import { NextRequest } from 'next/server'
import { POST as loginPOST } from '../../app/api/auth/login/route'
import { POST as refreshPOST } from '../../app/api/auth/refresh/route'
import { db } from '../../lib/db/mock-db'
import { validateBearerToken, signAccessToken } from '../../lib/auth'

describe('Auth flow', () => {
  it('should login successfully with valid credentials and return tokens', async () => {
    const response = await loginPOST(
      new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'user@globe.wallet', password: 'Password123!' }),
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('accessToken')
    expect(body.data).toHaveProperty('refreshToken')
    expect(body.data).toHaveProperty('expiresIn', 900)
    expect(validateBearerToken(
      new NextRequest('http://localhost/api/protected', {
        headers: { Authorization: `Bearer ${body.data.accessToken}` },
      }),
    )).toBe(true)
  })

  it('should rotate refresh token successfully', async () => {
    const loginResponse = await loginPOST(
      new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'user@globe.wallet', password: 'Password123!' }),
      }),
    )
    const loginBody = await loginResponse.json()
    const response = await refreshPOST(
      new NextRequest('http://localhost/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: loginBody.data.refreshToken }),
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('accessToken')
    expect(body.data).toHaveProperty('refreshToken')
    expect(body.data.accessToken).not.toBe(loginBody.data.accessToken)
    expect(body.data.refreshToken).not.toBe(loginBody.data.refreshToken)
  })
})
