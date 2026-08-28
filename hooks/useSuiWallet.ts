'use client'

import { useState, useCallback } from 'react'
import type { SuiBalance, SuiTransactionResult } from '../lib/types'

interface SuiBalancesState {
  balances: SuiBalance[]
  network: string | null
  loading: boolean
  error: string | null
}

/**
 * Fetches real, read-only balances for an arbitrary Sui address on testnet
 * via GET /api/sui/balance. No wallet connection or signing key required.
 * Mirrors hooks/useEvmWallet.ts.
 */
export function useSuiBalances() {
  const [state, setState] = useState<SuiBalancesState>({
    balances: [],
    network: null,
    loading: false,
    error: null,
  })

  const fetchBalances = useCallback(async (address: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch(`/api/sui/balance?address=${address}`)
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setState({ balances: [], network: null, loading: false, error: body.error || 'Failed to fetch balances' })
        return
      }

      setState({ balances: body.balances ?? [], network: body.network ?? null, loading: false, error: null })
    } catch (err) {
      setState({
        balances: [],
        network: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch balances',
      })
    }
  }, [])

  return { ...state, fetchBalances }
}

type SendStatus = 'idle' | 'processing' | 'success' | 'error'

interface SuiSendState {
  status: SendStatus
  error: string | null
  result: SuiTransactionResult | null
}

/**
 * Native SUI send via POST /api/sui/send. Mirrors useEvmSend's
 * status-machine shape (idle -> processing -> success | error).
 */
export function useSuiSend() {
  const [state, setState] = useState<SuiSendState>({ status: 'idle', error: null, result: null })

  const reset = useCallback(() => setState({ status: 'idle', error: null, result: null }), [])

  const send = useCallback(async (destination: string, amount: number) => {
    setState({ status: 'processing', error: null, result: null })
    try {
      const response = await fetch('/api/sui/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer globe-wallet-client' },
        body: JSON.stringify({ destination, amount }),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setState({ status: 'error', error: body.error || 'Send failed', result: null })
        return
      }

      setState({ status: 'success', error: null, result: body as SuiTransactionResult })
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : 'Send failed', result: null })
    }
  }, [])

  return { ...state, send, reset }
}
