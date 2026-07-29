'use client'

import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { VirtualList } from '@/components/ui/virtual-list'
import { TransactionStatusBadge } from '@/components/ui/transaction-status-badge'
import { TransactionStats } from '@/components/dashboard/transaction-stats'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { TransactionFilters } from '@/lib/types'
import { cn } from '@/lib/utils'

const TYPE_TABS: Array<{ label: string; value: TransactionFilters['type'] | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Incoming', value: 'in' },
  { label: 'Outgoing', value: 'out' },
]

export function TransactionHistoryView() {
  const {
    transactions,
    total,
    hasMore,
    loading,
    error,
    syncStatus,
    syncing,
    setSearch,
    setTypeFilter,
    nextPage,
    prevPage,
    sync,
    page,
  } = useTransactionHistory()

  const [activeTab, setActiveTab] = useState<'all' | 'in' | 'out'>('all')
  const [searchValue, setSearchValue] = useState('')

  function handleTabChange(tab: 'all' | 'in' | 'out') {
    setActiveTab(tab)
    setTypeFilter(tab === 'all' ? undefined : tab)
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchValue(e.target.value)
    setSearch(e.target.value)
  }

  const currentOffset = page?.offset ?? 0
  const pageSize = page?.limit ?? 20

  return (
    <section data-testid="transaction-history-view" className="flex flex-col gap-4 p-4">
      <TransactionStats
        total={total}
        syncStatus={syncStatus}
        onSync={sync}
        syncing={syncing}
      />

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          aria-label="Search transactions"
          data-testid="transaction-search"
          placeholder="Search by name, address, hash…"
          value={searchValue}
          onChange={handleSearchChange}
          className="pl-9"
        />
      </div>

      <nav aria-label="Transaction type filter" role="tablist" className="flex gap-1 rounded-xl bg-secondary p-1">
        {TYPE_TABS.map(tab => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeTab === tab.value}
            data-testid={`tab-${tab.value}`}
            onClick={() => handleTabChange(tab.value as 'all' | 'in' | 'out')}
            className={cn(
              'flex-1 rounded-lg py-1.5 text-xs font-medium transition-all',
              activeTab === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <ul aria-busy="true" aria-label="Transaction list" className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl bg-secondary" aria-hidden="true" />
          ))}
        </ul>
      ) : transactions.length === 0 ? (
        <p data-testid="empty-state" className="py-10 text-center text-sm text-muted-foreground">
          No transactions found
        </p>
      ) : (
          <VirtualList
            items={transactions}
            itemHeight={80}
            height={transactions.length <= 5 ? transactions.length * 80 : 320}
            listClassName="space-y-2"
            listTestId="transaction-list"
            listAriaLabel="Transaction list"
            role="list"
            renderItem={(tx, index, style) => {
              const isIncoming = tx.type === 'receive' || tx.type === 'in';
              return (
                <li
                  key={tx.id}
                  style={style}
                  data-testid="transaction-item"
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
                  role="listitem"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      isIncoming
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                    )}
                  >
                    {isIncoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {tx.name ?? (isIncoming ? 'Received' : 'Sent')}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{tx.date}</p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        isIncoming ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground',
                      )}
                    >
                      {isIncoming ? '+' : '-'}{tx.amount.toLocaleString()} {tx.asset}
                    </span>
                    <TransactionStatusBadge status={tx.status} />
                  </div>
                </li>
              );
            }}
          />
      )}

      {!loading && (total > pageSize) && (
        <div className="flex items-center justify-between gap-2" role="navigation" aria-label="Pagination">
          <Button
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={currentOffset === 0}
            aria-label="Previous page"
            data-testid="prev-page"
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentOffset + 1}–{Math.min(currentOffset + pageSize, total)} of {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={!hasMore}
            aria-label="Next page"
            data-testid="next-page"
          >
            Next
          </Button>
        </div>
      )}
    </section>
  )
}
