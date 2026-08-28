'use client'

import { useState, useCallback, useRef } from 'react'
import { useFinanceServices } from './useFinanceServices'
import { isValidStellarAddress, parseStellarAmount } from '../lib/helpers/format'
import { AssetCode, TransactionResult } from '../lib/types'

type SendStatus = 'idle' | 'processing' | 'success' | 'error'

export interface UseWalletSendReturn {
  /** Current status of the send operation */
  status: SendStatus
  /** True while the payment is in flight */
  isProcessing: boolean
  /** Error message if status === 'error' */
  error: string | null
  /** Transaction result if status === 'success' */
  result: TransactionResult | null
  /**
   * Initiate the send-payment flow. Resolves with the TransactionResult on
   * a completed call (success or a service-level failure), or `null` when
   * client-side validation rejected the input before any network call was
   * made — callers that need to react to the outcome (e.g. settling/rolling
   * back an optimistic UI entry, Issue #91) can use the return value
   * instead of re-deriving it from `status`/`result` after the await.
   */
  send: (
    destination: string,
    rawAmount: string,
    asset: AssetCode,
    memo?: string,
  ) => Promise<TransactionResult | null>
  /** Reset state back to idle */
  reset: () => void
}

/**
 * useWalletSend
 *
 * Dedicated hook encapsulating the full send-payment flow:
 *  1. Validates Stellar address format
 *  2. Parses and validates the amount
 *  3. Calls the wallet service
 *  4. Manages status transitions: idle → processing → success | error
 *
 * isProcessing is tracked here (not in the service) so the service stays
 * stateless and easily testable in isolation.
 */
export function useWalletSend(): UseWalletSendReturn {
  const { wallet } = useFinanceServices()

  const [status, setStatus] = useState<SendStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TransactionResult | null>(null)

  // Issue #85: one idempotency key per logical send attempt, not per
  // send() call. send-form.tsx's "Confirm Send" button can be clicked
  // again after an error without calling reset() (that's the actual retry
  // path here — reset() is only wired to "back to form" / "send another").
  // Generating a fresh key on every send() call would defeat idempotency
  // for exactly that retry case, so the key is created lazily on first use
  // and only cleared by reset() (a new logical attempt).
  const idempotencyKeyRef = useRef<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setResult(null)
    idempotencyKeyRef.current = null
  }, [])

  const send = useCallback(
    async (
      destination: string,
      rawAmount: string,
      asset: AssetCode,
      memo?: string,
    ): Promise<TransactionResult | null> => {
      // Client-side validation before hitting the service
      if (!isValidStellarAddress(destination)) {
        setError('Invalid Stellar address. Must be 56 characters starting with G.')
        setStatus('error')
        return null
      }

      let amount: number
      try {
        amount = parseStellarAmount(rawAmount)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Invalid amount')
        setStatus('error')
        return null
      }

      setStatus('processing')
      setError(null)
      setResult(null)

      try {
        if (!idempotencyKeyRef.current) {
          idempotencyKeyRef.current = crypto.randomUUID()
        }
        const txResult = await wallet.sendPayment(
          destination,
          amount,
          asset,
          memo,
          undefined,
          idempotencyKeyRef.current,
        )
        setResult(txResult)
        setStatus(txResult.success ? 'success' : 'error')
        if (!txResult.success) {
          setError(txResult.error ?? 'Payment failed')
        }
        return txResult
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred'
        setError(message)
        setStatus('error')
        return { success: false, error: message, status: 'failed' }
      }
    },
    [wallet],
  )

  return {
    status,
    isProcessing: status === 'processing',
    error,
    result,
    send,
    reset,
  }
}
