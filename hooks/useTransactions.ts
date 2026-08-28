import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useFinanceServices } from './useFinanceServices'
import { useErrorBoundary } from './useErrorBoundary'
import { Transaction, CurrencyCode, AssetCode, TransactionCategory } from '../lib/types'
import { db } from '@/lib/db/mock-db'
import {
  getOptimisticTransactions,
  subscribeOptimisticTransactions,
  reconcileOptimisticTransactions,
} from '@/lib/state/optimistic-transactions'

// Issue #79: native EventSource auto-reconnects on every error with a fixed
// (usually ~3s) delay forever, with no backoff and no way for the UI to
// know a stream is repeatedly failing (e.g. during a real backend outage).
// This hook manages reconnection itself instead of relying on the browser's
// built-in retry, so failures back off exponentially and eventually pause
// with a visible state rather than hammering /api/wallet/stream indefinitely.
const SSE_BASE_RECONNECT_DELAY_MS = 1000
const SSE_MAX_RECONNECT_DELAY_MS = 30_000
const SSE_MAX_CONSECUTIVE_FAILURES = 6

interface TransactionFilters {
  /** 'in' maps to 'receive'/'deposit', 'out' maps to 'send'/'withdraw'/'convert' */
  type?: 'in' | 'out'
  category?: TransactionCategory
  asset?: AssetCode
}

export function useTransactions() {
  const { wallet, fiat } = useFinanceServices()
  const { withErrorBoundary, hasError, error, captureError } = useErrorBoundary()

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Transaction[]>([])
  const [liveUpdatesPaused, setLiveUpdatesPaused] = useState(false)

  // Issue #91: mirror the shared optimistic-transaction store into this
  // hook instance's state so the send flow's "pending" entry shows up in
  // any transaction list rendered elsewhere, without a full context rewrite.
  const [optimisticItems, setOptimisticItems] = useState<Transaction[]>(
    getOptimisticTransactions(),
  )

  useEffect(() => {
    const unsubscribe = subscribeOptimisticTransactions(() => {
      setOptimisticItems(getOptimisticTransactions())
    })
    return unsubscribe
  }, [])

  // Initial load
  const loadInitial = useCallback(async () => {
    setLoading(true)
    try {
      const data = await wallet.getTransactionHistory()
      setItems(data)
      setLoading(false)
      return data
    } catch (err) {
      setLoading(false)
      captureError(err as any)
      return []
    }
  }, [wallet, captureError])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  // SSE subscription for live updates, with our own exponential backoff
  // (Issue #79) instead of relying on the browser's fixed-interval retry.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let consecutiveFailures = 0;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const newTxs: Transaction[] = Array.isArray(data) ? data : [data];
        setItems(prev => {
          // If bulk initial payload received after initial load, ignore to avoid duplicates
          if (prev.length > 0 && newTxs.length > 1) {
            return prev;
          }
          const existingIds = new Set(prev.map(tx => tx.id));
          const filtered = newTxs.filter(tx => !existingIds.has(tx.id));
          return [...filtered, ...prev];
        });
        // Issue #91: once the real, confirmed transaction(s) sync in over
        // the stream, drop any optimistic placeholder with a matching
        // stellarHash so it doesn't keep showing alongside the real entry.
        reconcileOptimisticTransactions(newTxs);
      } catch {}
    };

    const connect = () => {
      if (cancelled) return;

      es = new EventSource('/api/wallet/stream');
      es.addEventListener('message', handleMessage);

      es.onopen = () => {
        // A successful connection resets the backoff and clears any paused state.
        consecutiveFailures = 0;
        setLiveUpdatesPaused(false);
      };

      es.onerror = () => {
        // Close explicitly and drive reconnection ourselves rather than
        // letting the browser's built-in (fixed-delay, unbounded) retry
        // hammer the endpoint during an outage.
        es?.close();
        es = null;

        if (cancelled) return;

        consecutiveFailures += 1;

        if (consecutiveFailures >= SSE_MAX_CONSECUTIVE_FAILURES) {
          // Stop retrying and surface a paused state instead of retrying
          // forever. refreshBalances-style manual recovery isn't wired up
          // here since polling isn't this hook's job; a future refresh
          // (e.g. remount, or a "reconnect" action) will try again.
          setLiveUpdatesPaused(true);
          return;
        }

        const delay = Math.min(
          SSE_BASE_RECONNECT_DELAY_MS * 2 ** (consecutiveFailures - 1),
          SSE_MAX_RECONNECT_DELAY_MS,
        );
        clearReconnectTimer();
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      es?.removeEventListener('message', handleMessage);
      es?.close();
      es = null;
    };
  }, []);


  // Issue #91: merge the optimistic (pending, not-yet-confirmed) entries on
  // top of the loaded/streamed items. Anything already reconciled into
  // `items` itself (matching id) is skipped so it isn't shown twice.
  const combinedItems = useMemo(() => {
    if (optimisticItems.length === 0) return items
    const existingIds = new Set(items.map((t) => t.id))
    return [...optimisticItems.filter((t) => !existingIds.has(t.id)), ...items]
  }, [items, optimisticItems])

  const getTransactions = useCallback(
    async (filters?: TransactionFilters): Promise<Transaction[]> => {
      // Simple filtering on the client side for now
      if (!filters) return combinedItems
      let filtered = combinedItems
      if (filters.type) {
        const inTypes = ['receive', 'deposit', 'in']
        const outTypes = ['send', 'withdraw', 'convert', 'out']
        filtered = filtered.filter(t =>
          filters.type === 'in' ? inTypes.includes(t.type) : outTypes.includes(t.type)
        )
      }
      if (filters.category) {
        filtered = filtered.filter(t => t.category === filters.category)
      }
      if (filters.asset) {
        filtered = filtered.filter(t => t.asset === filters.asset)
      }
      return filtered
    },
    [combinedItems]
  )

  // Format transaction amount
  const formatTransactionAmount = useCallback(
    (transaction: Transaction, targetCurrency: CurrencyCode = 'USD'): string => {
      const fallback = `${transaction.amount} ${transaction.asset}`
      try {
        if (transaction.currency) {
          return fiat.formatMoney(transaction.amount, transaction.currency)
        }
        return fallback
      } catch (err) {
        captureError(err as any)
        return fallback
      }
    },
    [fiat, captureError]
  )

  const getTransactionsByCategory = useCallback(
    async (category: TransactionCategory) => getTransactions({ category }),
    [getTransactions]
  )

  const getTransactionsByType = useCallback(
    async (type: 'in' | 'out') => getTransactions({ type }),
    [getTransactions]
  )

  const getTransactionsByAsset = useCallback(
    async (asset: AssetCode) => getTransactions({ asset }),
    [getTransactions]
  )

  const calculateCategoryTotal = useCallback(
    async (category: TransactionCategory, currency: CurrencyCode): Promise<number> => {
      const txs = await getTransactions({ category })
      const inTypes = ['receive', 'deposit', 'in']
      return txs.reduce((sum, tx) => {
        const isIncoming = inTypes.includes(tx.type)
        const multiplier = isIncoming ? 1 : -1
        return sum + tx.amount * multiplier
      }, 0)
    },
    [getTransactions]
  )

  return {
    loading,
    hasError,
    error,
    // Issue #79: true once the SSE stream has failed
    // SSE_MAX_CONSECUTIVE_FAILURES times in a row and stopped retrying.
    // `items` still reflects the last successful loadInitial()/stream state;
    // this just tells the UI that live updates are no longer arriving.
    liveUpdatesPaused,
    getTransactions,
    formatTransactionAmount,
    getTransactionsByCategory,
    getTransactionsByType,
    getTransactionsByAsset,
    calculateCategoryTotal,
    // expose items for components if needed — includes any pending
    // optimistic entries merged on top (Issue #91)
    items: combinedItems,
  }
}
