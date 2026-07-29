'use client'

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { StellarAccount, WalletAccount } from '@/lib/types'
import { useFinanceServices } from '@/hooks/useFinanceServices'

interface ActiveAccountContextValue {
  accounts: WalletAccount[]
  activeAccount: StellarAccount
  activeAccountId: string | null
  switchAccount: (accountId: string) => void
}

const ActiveAccountContext = createContext<ActiveAccountContextValue | null>(null)

export function ActiveAccountProvider({ children }: { children: ReactNode }) {
  const { wallet } = useFinanceServices()
  const [revision, setRevision] = useState(0)

  const accounts = useMemo(() => {
    void revision
    return wallet.listAccounts()
  }, [wallet, revision])

  const activeAccount = useMemo(() => {
    void revision
    return wallet.getAccountInfo()
  }, [wallet, revision])

  const activeAccountId = useMemo(() => {
    void revision
    return wallet.getActiveAccountId()
  }, [wallet, revision])

  const switchAccount = useCallback(
    (accountId: string) => {
      wallet.switchAccount(accountId)
      setRevision((n) => n + 1)
      // Keep the server-side MockDB active account in sync for API routes.
      void fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      }).catch(() => {
        // Client switch already succeeded; server sync is best-effort in mock mode.
      })
    },
    [wallet],
  )

  const value = useMemo(
    () => ({
      accounts,
      activeAccount,
      activeAccountId,
      switchAccount,
    }),
    [accounts, activeAccount, activeAccountId, switchAccount],
  )

  return createElement(ActiveAccountContext.Provider, { value }, children)
}

export function useActiveAccount(): ActiveAccountContextValue {
  const ctx = useContext(ActiveAccountContext)
  if (!ctx) {
    throw new Error('useActiveAccount must be used within ActiveAccountProvider')
  }
  return ctx
}
