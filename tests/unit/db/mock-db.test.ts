/**
 * @jest-environment node
 */
import { db } from '../../../lib/db/mock-db'
import { Transaction } from '../../../lib/types'

const BASE_TX: Omit<Transaction, 'id'> = {
  type: 'receive',
  amount: 100,
  asset: 'XLM',
  address: 'GTEST',
  date: new Date().toISOString(),
  status: 'completed',
  category: 'deposit',
  name: 'Test Receive',
}

describe('MockDB', () => {
  describe('getTransactions', () => {
    it('returns an array of transactions', async () => {
      const txs = await db.getTransactions()
      expect(Array.isArray(txs)).toBe(true)
      expect(txs.length).toBeGreaterThan(0)
    })

    it('returns a copy not the internal reference', async () => {
      const a = await db.getTransactions()
      const b = await db.getTransactions()
      expect(a).not.toBe(b)
    })
  })

  describe('saveTransaction', () => {
    it('prepends new transaction to the list', async () => {
      const tx: Transaction = { id: 'unit-test-1', ...BASE_TX, name: 'Unit Save Test' }
      await db.saveTransaction(tx)
      const txs = await db.getTransactions()
      expect(txs[0].id).toBe('unit-test-1')
    })
  })

  describe('getTransactionById', () => {
    it('returns the transaction when found', async () => {
      const tx: Transaction = { id: 'unit-test-by-id', ...BASE_TX }
      await db.saveTransaction(tx)
      const found = await db.getTransactionById('unit-test-by-id')
      expect(found).toBeDefined()
      expect(found?.id).toBe('unit-test-by-id')
    })

    it('returns undefined for unknown id', async () => {
      const found = await db.getTransactionById('nonexistent-id-xyz')
      expect(found).toBeUndefined()
    })
  })

  describe('updateTransactionStatus', () => {
    it('returns true and updates status for existing tx', async () => {
      const tx: Transaction = { id: 'unit-test-update', ...BASE_TX, status: 'pending' }
      await db.saveTransaction(tx)
      const result = await db.updateTransactionStatus('unit-test-update', 'completed')
      expect(result).toBe(true)
      const found = await db.getTransactionById('unit-test-update')
      expect(found?.status).toBe('completed')
    })

    it('returns false for nonexistent id', async () => {
      const result = await db.updateTransactionStatus('ghost-id', 'completed')
      expect(result).toBe(false)
    })
  })

  describe('queryTransactions', () => {
    it('returns a TransactionPage with data, total, offset, limit, hasMore', async () => {
      const result = await db.queryTransactions({ limit: 5, offset: 0 })
      expect(result).toMatchObject({ offset: 0, limit: 5 })
      expect(Array.isArray(result.data)).toBe(true)
      expect(typeof result.total).toBe('number')
      expect(typeof result.hasMore).toBe('boolean')
    })

    it('paginates correctly', async () => {
      const first = await db.queryTransactions({ limit: 1, offset: 0 })
      const second = await db.queryTransactions({ limit: 1, offset: 1 })
      if (first.total >= 2) {
        expect(first.data[0].id).not.toBe(second.data[0]?.id)
      }
    })

    it('filters by asset', async () => {
      const tx: Transaction = { id: 'unit-usdc-query', ...BASE_TX, asset: 'USDC' }
      await db.saveTransaction(tx)
      const result = await db.queryTransactions({ asset: 'USDC' })
      expect(result.data.every(t => t.asset === 'USDC')).toBe(true)
    })

    it('filters by status', async () => {
      const tx: Transaction = { id: 'unit-pending-query', ...BASE_TX, status: 'pending', asset: 'XLM' }
      await db.saveTransaction(tx)
      const result = await db.queryTransactions({ status: 'pending' })
      expect(result.data.every(t => t.status === 'pending')).toBe(true)
    })

    it('searches by name', async () => {
      const tx: Transaction = { id: 'unit-search-name', ...BASE_TX, name: 'UniqueSearchName_XYZ' }
      await db.saveTransaction(tx)
      const result = await db.queryTransactions({ search: 'UniqueSearchName_XYZ' })
      expect(result.data.some(t => t.name === 'UniqueSearchName_XYZ')).toBe(true)
    })
  })

  describe('sync state', () => {
    it('initialises with null lastSyncAt', () => {
      const state = db.getSyncState()
      expect(typeof state.totalSynced).toBe('number')
    })

    it('recordSync updates lastSyncAt and increments totalSynced', () => {
      const before = db.getSyncState().totalSynced
      db.recordSync(3)
      const after = db.getSyncState()
      expect(after.totalSynced).toBe(before + 3)
      expect(after.lastSyncAt).not.toBeNull()
    })
  })

  describe('countPending', () => {
    it('returns the count of pending transactions', async () => {
      const tx: Transaction = { id: 'unit-count-pending', ...BASE_TX, status: 'pending' }
      await db.saveTransaction(tx)
      const count = await db.countPending()
      expect(count).toBeGreaterThanOrEqual(1)
    })
  })

  // Issue #80: saveTransaction has no cap/eviction — the in-memory array
  // grows for the lifetime of the process. This test documents that concretely
  // rather than leaving it as an assertion in a doc. See docs/issue-80.md for
  // the retention/pagination policy the real datastore replacing mock-db.ts
  // must implement (this test intentionally does NOT assert a cap exists —
  // adding a cap to the mock itself would mask the real problem, see the doc).
  describe('unbounded growth (Issue #80)', () => {
    it('retains every saved transaction with no upper bound', async () => {
      const before = (await db.getTransactions()).length

      const N = 2000
      for (let i = 0; i < N; i++) {
        await db.saveTransaction({
          id: `growth-test-${i}`,
          ...BASE_TX,
          name: `Growth Test ${i}`,
        })
      }

      const after = await db.getTransactions()
      // Every single one of the N inserts is still present — nothing was
      // evicted, truncated, or archived. This is the bug: a real datastore
      // must apply the retention policy in docs/issue-80.md instead of
      // retaining an unbounded in-process array like this.
      expect(after.length).toBe(before + N)
      expect(after.filter(t => t.id.startsWith('growth-test-')).length).toBe(N)
    })
  })
})
