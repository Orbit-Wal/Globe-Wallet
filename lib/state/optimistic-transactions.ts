import type { Transaction } from '@/lib/types'

/**
 * Issue #91 — shared optimistic-transaction store.
 *
 * SendForm and any transaction-list view (components/app/transaction-list.tsx
 * etc.) each call useTransactions() independently, and that hook keeps its
 * `items` state local to the component instance — there's no app-wide
 * store/context wiring it together. Adding a full context provider just for
 * this would touch app/[locale]/layout.tsx and every existing consumer.
 *
 * Instead this is a tiny module-level pub/sub: a singleton list of
 * "in-flight, not yet confirmed" transactions that any useTransactions()
 * instance can subscribe to and merge into its own `items`. That's enough to
 * get the optimistic-append / rollback / no-duplicate-on-confirm behavior
 * the issue asks for without a bigger state-management rewrite.
 */

type Listener = () => void

let optimisticItems: Transaction[] = []
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function subscribeOptimisticTransactions(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getOptimisticTransactions(): Transaction[] {
  return optimisticItems
}

/** Append a new optimistic ("pending, not yet confirmed") transaction. */
export function addOptimisticTransaction(tx: Transaction): void {
  optimisticItems = [tx, ...optimisticItems]
  emit()
}

/** Rollback: the real send failed, so drop the optimistic entry entirely. */
export function removeOptimisticTransaction(id: string): void {
  const next = optimisticItems.filter((t) => t.id !== id)
  if (next.length !== optimisticItems.length) {
    optimisticItems = next
    emit()
  }
}

/** The real send succeeded — patch the optimistic entry with confirmed details. */
export function settleOptimisticTransaction(id: string, patch: Partial<Transaction>): void {
  let changed = false
  optimisticItems = optimisticItems.map((t) => {
    if (t.id !== id) return t
    changed = true
    return { ...t, ...patch }
  })
  if (changed) emit()
}

/**
 * Drop any settled optimistic entries whose stellarHash now has a matching
 * confirmed transaction in `confirmed` (e.g. delivered over the SSE stream
 * from /api/wallet/stream). Prevents the optimistic placeholder and the
 * real, synced transaction from both being shown at once.
 */
export function reconcileOptimisticTransactions(confirmed: Transaction[]): void {
  const confirmedHashes = new Set(
    confirmed.map((t) => t.stellarHash).filter((h): h is string => Boolean(h)),
  )
  if (confirmedHashes.size === 0) return
  const next = optimisticItems.filter(
    (t) => !(t.stellarHash && confirmedHashes.has(t.stellarHash)),
  )
  if (next.length !== optimisticItems.length) {
    optimisticItems = next
    emit()
  }
}

/** Test-only escape hatch to avoid state leaking between test files/cases. */
export function __resetOptimisticTransactionsForTests(): void {
  optimisticItems = []
  listeners.clear()
}
