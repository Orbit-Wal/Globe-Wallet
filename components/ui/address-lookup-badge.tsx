"use client"

import { Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import type { AddressLookupResult } from "@/lib/types"

interface AddressLookupBadgeProps {
  result: AddressLookupResult
  className?: string
}

/**
 * AddressLookupBadge — Issue #11
 *
 * Renders a small inline status indicator below the address input field when
 * the user has typed a Stellar federated address (user*domain.tld).
 *
 * States:
 *  - idle      → nothing rendered
 *  - resolving → spinner + "Resolving address…"
 *  - resolved  → green chip showing shortened public key (+ memo if present)
 *  - not-found → amber warning
 *  - error     → red error message
 */
export function AddressLookupBadge({ result, className = "" }: AddressLookupBadgeProps) {
  const { status, resolved, federationMemo, error } = result

  if (status === "idle") return null

  if (status === "resolving") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Resolving federated address"
        data-testid="lookup-resolving"
        className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Resolving address…
      </div>
    )
  }

  if (status === "resolved" && resolved) {
    const short = `${resolved.slice(0, 8)}…${resolved.slice(-6)}`
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={`Resolved to ${resolved}`}
        data-testid="lookup-resolved"
        className={`flex flex-col gap-0.5 text-xs ${className}`}
      >
        <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          <span className="font-mono">{short}</span>
        </span>
        {federationMemo && (
          <span className="text-muted-foreground pl-4.5">
            Memo: <span className="font-mono">{federationMemo}</span>
          </span>
        )}
      </div>
    )
  }

  if (status === "not-found") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="lookup-not-found"
        className={`flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 ${className}`}
      >
        <AlertTriangle className="h-3 w-3" aria-hidden />
        No federation record found for this address.
      </div>
    )
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="lookup-error"
        className={`flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400 ${className}`}
      >
        <XCircle className="h-3 w-3" aria-hidden />
        {error ?? "Address lookup failed."}
      </div>
    )
  }

  return null
}
