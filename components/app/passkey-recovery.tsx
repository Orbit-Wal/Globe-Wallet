'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle, Copy, Loader2 } from 'lucide-react'

export function PasskeyRecovery() {
  const [email, setEmail] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [newRecoveryKey, setNewRecoveryKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')

  const generateRecoveryKey = () => {
    const key = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    setNewRecoveryKey(key)
    setStatus('Recovery key generated! Copy it immediately.')
  }

  const copyRecoveryKey = async () => {
    if (newRecoveryKey) {
      await navigator.clipboard.writeText(newRecoveryKey)
      setStatus('Recovery key copied!')
    }
  }

  const handleRecover = () => {
    setStatus('Recovery process started (placeholder).')
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-background border rounded-lg">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-6 h-6 text-amber-500" />
        <h3 className="text-xl font-semibold">Passkey Recovery</h3>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recovery-email">Email</Label>
        <Input
          id="recovery-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recovery-key">Recovery Key</Label>
        <Input
          id="recovery-key"
          type="text"
          value={recoveryKey}
          onChange={(e) => setRecoveryKey(e.target.value)}
          placeholder="Enter your recovery key"
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={generateRecoveryKey}
          disabled={isLoading}
          variant="outline"
        >
          Generate New Recovery Key
        </Button>
        {newRecoveryKey && (
          <Button
            onClick={copyRecoveryKey}
            disabled={isLoading}
            variant="ghost"
            className="flex-1"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Key
          </Button>
        )}
        <Button
          onClick={handleRecover}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4 mr-2" />
          )}
          Recover Account
        </Button>
      </div>

      {newRecoveryKey && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Your recovery key: <code className="font-mono">{newRecoveryKey}</code>
          </p>
        </div>
      )}

      {status && (
        <p className="text-sm text-muted-foreground">{status}</p>
      )}
    </div>
  )
}
