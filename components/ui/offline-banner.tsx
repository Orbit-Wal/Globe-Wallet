'use client'

import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * Issue #94 — explicit, visible offline indicator (rendered app-wide from
 * the root layout) rather than the app just going blank or actions failing
 * silently when there's no network.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="flex items-center justify-center gap-2 bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-400"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        You&apos;re offline — showing last-known balances and transactions. Sending and
        off-ramp actions are disabled until your connection is back.
      </span>
    </div>
  )
}
