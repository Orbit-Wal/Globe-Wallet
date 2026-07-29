'use client'

import { useState, useCallback } from 'react'
import type { EvmBalance, EvmChainId, EvmTransactionResult } from '../lib/types'

interface EvmBalancesState {
  balances: EvmBalance[]
  network: string | null
  loading: boolean
  error: string | null
}

/**
 * Fetches real, read-only balances for an arbitrary EVM address on
 * Base Sepolia / Ethereum Sepolia via GET /api/evm/balance. No wallet
 * connection or signing key required — this is a "watch any address" query,
 * same shape as pasting an address into a block explorer.
 */
export function useEvmBalances() {
  const [state, setState] = useState<EvmBalancesState>({
    balances: [],
    network: null,
    loading: false,
    error: null,
  })

  const fetchBalances = useCallback(async (chainId: EvmChainId, address: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch(`/api/evm/balance?chainId=${chainId}&address=${address}`)
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

interface EvmSendState {
  status: SendStatus
  error: string | null
  result: EvmTransactionResult | null
}

/**
 * Native-currency send via POST /api/evm/send. Mirrors useWalletSend's
 * status-machine shape (idle -> processing -> success | error) for a
 * consistent SendForm UX pattern across chains.
 */
export function useEvmSend() {
  const [state, setState] = useState<EvmSendState>({ status: 'idle', error: null, result: null })

  const reset = useCallback(() => setState({ status: 'idle', error: null, result: null }), [])

  const send = useCallback(async (chainId: EvmChainId, destination: string, amount: number) => {
    setState({ status: 'processing', error: null, result: null })
    try {
      const response = await fetch('/api/evm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer globe-wallet-client' },
        body: JSON.stringify({ chainId, destination, amount }),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setState({ status: 'error', error: body.error || 'Send failed', result: null })
        return
      }

      setState({ status: 'success', error: null, result: body as EvmTransactionResult })
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : 'Send failed', result: null })
    }
  }, [])

  return { ...state, send, reset }
}
