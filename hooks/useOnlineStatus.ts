'use client'

import { useEffect, useState } from 'react'

/**
 * Issue #94 — tracks browser connectivity via the `online`/`offline` window
 * events (backed by navigator.onLine) so UI (send/off-ramp actions, banners)
 * can react to a lost connection instead of only finding out when a fetch
 * call fails.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return isOnline
}
