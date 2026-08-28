/**
 * Issue #91 — the shared optimistic-transaction store used by the send flow
 * (components/app/send-form.tsx) and merged into any useTransactions()
 * consumer (hooks/useTransactions.ts). Covers the three DoD bullets
 * directly against the store:
 *   - append on submit
 *   - rollback on failure
 *   - no duplicate once the real, confirmed transaction (matched by
 *     stellarHash) syncs in
 */
import type { Transaction } from '../../../lib/types'
import {
  addOptimisticTransaction,
  removeOptimisticTransaction,
  settleOptimisticTransaction,
  reconcileOptimisticTransactions,
  getOptimisticTransactions,
  subscribeOptimisticTransactions,
  __resetOptimisticTransactionsForTests,
} from '../../../lib/state/optimistic-transactions'

function pendingTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'optimistic-1',
    type: 'send',
    amount: 100,
    asset: 'XLM',
    address: 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX',
    date: new Date().toISOString(),
    status: 'pending',
    category: 'payment',
    ...overrides,
  }
}

describe('optimistic-transactions store (Issue #91)', () => {
  beforeEach(() => {
    __resetOptimisticTransactionsForTests()
  })

  it('appends an optimistic entry immediately on submit', () => {
    expect(getOptimisticTransactions()).toHaveLength(0)
    addOptimisticTransaction(pendingTx())
    expect(getOptimisticTransactions()).toHaveLength(1)
    expect(getOptimisticTransactions()[0].status).toBe('pending')
  })

  it('rolls back (removes) the optimistic entry when the real send fails', () => {
    addOptimisticTransaction(pendingTx())
    expect(getOptimisticTransactions()).toHaveLength(1)

    removeOptimisticTransaction('optimistic-1')

    expect(getOptimisticTransactions()).toHaveLength(0)
  })

  it('settles the optimistic entry in place when the real send succeeds', () => {
    addOptimisticTransaction(pendingTx())

    settleOptimisticTransaction('optimistic-1', { status: 'completed', stellarHash: 'abc123' })

    const [tx] = getOptimisticTransactions()
    expect(tx.status).toBe('completed')
    expect(tx.stellarHash).toBe('abc123')
  })

  it('drops the settled optimistic entry once a confirmed transaction with the matching hash syncs in — no duplicate', () => {
    addOptimisticTransaction(pendingTx())
    settleOptimisticTransaction('optimistic-1', { status: 'completed', stellarHash: 'abc123' })
    expect(getOptimisticTransactions()).toHaveLength(1)

    const confirmed: Transaction = {
      id: 'real-tx-42',
      type: 'send',
      amount: 100,
      asset: 'XLM',
      address: 'GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX',
      date: new Date().toISOString(),
      status: 'completed',
      category: 'payment',
      stellarHash: 'abc123',
    }

    reconcileOptimisticTransactions([confirmed])

    expect(getOptimisticTransactions()).toHaveLength(0)
  })

  it('leaves unrelated optimistic entries alone when reconciling a non-matching hash', () => {
    addOptimisticTransaction(pendingTx({ id: 'optimistic-2', stellarHash: 'other-hash' }))

    reconcileOptimisticTransactions([{ ...pendingTx(), id: 'real-tx', stellarHash: 'unrelated-hash' }])

    expect(getOptimisticTransactions()).toHaveLength(1)
  })

  it('notifies subscribers on every store mutation', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeOptimisticTransactions(listener)

    addOptimisticTransaction(pendingTx())
    expect(listener).toHaveBeenCalledTimes(1)

    settleOptimisticTransaction('optimistic-1', { status: 'completed' })
    expect(listener).toHaveBeenCalledTimes(2)

    removeOptimisticTransaction('optimistic-1')
    expect(listener).toHaveBeenCalledTimes(3)

    unsubscribe()
    addOptimisticTransaction(pendingTx({ id: 'optimistic-3' }))
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
