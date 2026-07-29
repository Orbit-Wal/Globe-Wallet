import { useEffect, useState, useCallback } from 'react'
import { useFinanceServices } from './useFinanceServices'
import { useErrorBoundary } from './useErrorBoundary'
import { Transaction, CurrencyCode, AssetCode, TransactionCategory } from '../lib/types'
import { db } from '@/lib/db/mock-db'

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
      throw err
    }
  }, [wallet])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  // SSE subscription for live updates
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }
    const es = new EventSource('/api/wallet/stream');
    const handler = (e: MessageEvent) => {
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
      } catch {}
    };
    es.addEventListener('message', handler);
    es.onerror = () => {
      // Browser will attempt reconnection automatically
    };
    return () => {
      es.removeEventListener('message', handler);
      es.close();
    };
  }, []);


  const getTransactions = useCallback(
    async (filters?: TransactionFilters): Promise<Transaction[]> => {
      // Simple filtering on the client side for now
      if (!filters) return items
      let filtered = items
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
    [items]
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
    getTransactions,
    formatTransactionAmount,
    getTransactionsByCategory,
    getTransactionsByType,
    getTransactionsByAsset,
    calculateCategoryTotal,
    // expose items for components if needed
    items,
  }
}
