'use client'

import { Wallet } from 'lucide-react'
import { useActiveAccount } from '@/hooks/useActiveAccount'
import { useFinanceServices } from '@/hooks/useFinanceServices'
import { cn } from '@/lib/utils'

interface AccountSwitcherProps {
  className?: string
  /** Compact trigger for tight headers */
  size?: 'sm' | 'default'
}

export function AccountSwitcher({ className, size = 'default' }: AccountSwitcherProps) {
  const { accounts, activeAccountId, switchAccount } = useActiveAccount()
  const { wallet } = useFinanceServices()

  if (accounts.length === 0) {
    return null
  }

  return (
    <div className={cn('w-full', className)} data-testid="account-switcher">
      <label className="sr-only" htmlFor="stellar-account-switcher">
        Switch Stellar account
      </label>
      <div className="relative flex items-center">
        <Wallet
          className="pointer-events-none absolute left-3 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <select
          id="stellar-account-switcher"
          aria-label="Switch Stellar account"
          data-testid="account-switcher-trigger"
          data-size={size}
          className={cn(
            'border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full appearance-none rounded-md border py-2 pr-8 pl-9 text-sm shadow-xs outline-none focus-visible:ring-[3px]',
            size === 'sm' ? 'h-8' : 'h-9',
          )}
          value={activeAccountId ?? ''}
          onChange={(event) => switchAccount(event.target.value)}
        >
          {accounts.map((account) => (
            <option
              key={account.id}
              value={account.id}
              data-testid={`account-option-${account.id}`}
            >
              {account.name}
              {account.isPrimary ? ' (Primary)' : ''} — {wallet.shortenKey(account.publicKey)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
