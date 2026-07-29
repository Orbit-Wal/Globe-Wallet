'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser'
import { Key, Fingerprint, Loader2 } from 'lucide-react'

export function PasskeyAuth() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')

  const handleRegister = async () => {
    setIsLoading(true)
    setStatus('')
    try {
      const optionsRes = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const options = await optionsRes.json()

      const regResult = await startRegistration(options)
      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          response: regResult,
          expectedChallenge: options.challenge,
        }),
      })
      const verify = await verifyRes.json()
      if (verify.verified) {
        setStatus('Passkey registered successfully!')
      }
    } catch (e) {
      setStatus('Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuthenticate = async () => {
    setIsLoading(true)
    setStatus('')
    try {
      const optionsRes = await fetch('/api/webauthn/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const options = await optionsRes.json()

      const authResult = await startAuthentication(options)
      const verifyRes = await fetch('/api/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          response: authResult,
          expectedChallenge: options.challenge,
        }),
      })
      const verify = await verifyRes.json()
      if (verify.verified) {
        setStatus('Authenticated successfully!')
      }
    } catch (e) {
      setStatus('Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-background border rounded-lg">
      <div className="flex items-center gap-2">
        <Key className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-semibold">Passkey Authentication</h3>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleRegister}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Fingerprint className="w-4 h-4 mr-2" />
          )}
          Register Passkey
        </Button>
        <Button
          onClick={handleAuthenticate}
          disabled={isLoading}
          variant="secondary"
          className="flex-1"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Fingerprint className="w-4 h-4 mr-2" />
          )}
          Authenticate
        </Button>
      </div>

      {status && (
        <p className="text-sm text-muted-foreground">{status}</p>
      )}
    </div>
  )
}
