'use client'

import { useState, useCallback } from 'react'
import type { SolanaBalance, SolanaTransactionResult } from '../lib/types'

interface SolanaBalancesState {
  balances: SolanaBalance[]
  network: string | null
  loading: boolean
  error: string | null
}

/**
 * Fetches real, read-only balances for an arbitrary Solana address on
 * devnet via GET /api/solana/balance. No wallet connection or signing key
 * required. Mirrors hooks/useEvmWallet.ts.
 */
export function useSolanaBalances() {
  const [state, setState] = useState<SolanaBalancesState>({
    balances: [],
    network: null,
    loading: false,
    error: null,
  })

  const fetchBalances = useCallback(async (address: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch(`/api/solana/balance?address=${address}`)
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

interface SolanaSendState {
  status: SendStatus
  error: string | null
  result: SolanaTransactionResult | null
}

/**
 * Native SOL send via POST /api/solana/send. Mirrors useEvmSend's
 * status-machine shape (idle -> processing -> success | error).
 */
export function useSolanaSend() {
  const [state, setState] = useState<SolanaSendState>({ status: 'idle', error: null, result: null })

  const reset = useCallback(() => setState({ status: 'idle', error: null, result: null }), [])

  const send = useCallback(async (destination: string, amount: number) => {
    setState({ status: 'processing', error: null, result: null })
    try {
      const response = await fetch('/api/solana/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer globe-wallet-client' },
        body: JSON.stringify({ destination, amount }),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setState({ status: 'error', error: body.error || 'Send failed', result: null })
        return
      }

      setState({ status: 'success', error: null, result: body as SolanaTransactionResult })
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : 'Send failed', result: null })
    }
  }, [])

  return { ...state, send, reset }
}
