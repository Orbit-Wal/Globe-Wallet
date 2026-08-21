/**
 * lib/api/wallet-client.ts
 * Issue #18 — Typed API client for Globe Wallet API routes.
 *
 * All methods call the Next.js App Router API routes under /api/wallet/*.
 * The base URL is read from NEXT_PUBLIC_API_BASE_URL (defaults to empty string
 * so relative paths work in the browser). Never includes private keys or secrets.
 */

import type { Balance, ErrorCode, Transaction, TransactionResult } from '../types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SendPayload {
  destination: string
  amount: number
  asset: string
  memo?: string
  /**
   * Issue #85: /api/wallet/send rejects requests without this. Optional
   * here only so existing call shapes still type-check; postTransaction
   * fills in a fresh one when the caller doesn't supply it. A caller that
   * wants real retry protection should generate its own and pass the same
   * value on every retry of one logical attempt (see hooks/useWalletSend.ts
   * for the pattern actually used by the app's send flow).
   */
  idempotencyKey?: string
}

export interface RatesResponse {
  rates: Record<string, number>
  updatedAt: string
}

export interface ApiError {
  error: string
  code?: ErrorCode
}

// ── Client ───────────────────────────────────────────────────────────────────

const API_BASE =
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? '')
    : ''

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!res.ok) {
    let message = `API error ${res.status}`
    try {
      const body = (await res.json()) as ApiError
      message = body.error ?? message
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  return res.json() as Promise<T>
}

// ── Exported API client ──────────────────────────────────────────────────────

/**
 * Fetch all asset balances for the connected wallet.
 */
export async function fetchBalances(): Promise<Balance[]> {
  return apiFetch<Balance[]>('/api/wallet/balances')
}

/**
 * Post a send-payment request; returns the transaction result.
 */
export async function postTransaction(payload: SendPayload): Promise<TransactionResult> {
  const body: SendPayload = {
    ...payload,
    idempotencyKey: payload.idempotencyKey ?? crypto.randomUUID(),
  }
  return apiFetch<TransactionResult>('/api/wallet/send', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * Fetch the transaction history for the connected wallet.
 */
export async function fetchTransactions(): Promise<Transaction[]> {
  return apiFetch<Transaction[]>('/api/wallet/transactions')
}

/**
 * Fetch current fiat/crypto exchange rates.
 */
export async function fetchRates(): Promise<RatesResponse> {
  return apiFetch<RatesResponse>('/api/rates')
}
