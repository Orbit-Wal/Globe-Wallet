import { BaseService } from './base.service'
import {
  AddTransactionRequest,
  ITransactionSyncService,
  Transaction,
  TransactionSyncResult,
  TransactionSyncStatus,
} from '../types'
import { db } from '../db/mock-db'
import { generateTransactionId, isoToDisplayDate } from '../transaction-utils'
import { Horizon } from '@stellar/stellar-sdk'

// Replaced by real Horizon sync

export class TransactionSyncService extends BaseService implements ITransactionSyncService {
  private isSyncing = false

  async syncFromNetwork(accountId?: string): Promise<TransactionSyncResult> {
    return this.withPerformanceTracking('TransactionSyncService.syncFromNetwork', async () => {
      if (this.isSyncing) {
        return { added: 0, updated: 0, failed: 0, lastSyncAt: new Date().toISOString() }
      }

      this.isSyncing = true
      let added = 0
      let updated = 0
      let failed = 0

      try {
        const account = await db.resolveAccount(accountId)
        const publicKey = account.publicKey
        const server = new Horizon.Server('https://horizon-testnet.stellar.org')
        const existing = await db.getTransactions()
        const existingHashes = new Set(existing.map(t => t.stellarHash).filter(Boolean))
        const state = db.getSyncState()
        let latestCursor = state.lastSyncCursor || '0' // Default to 0 to get oldest first, or just some cursor

        try {
          const page = await server.transactions()
            .forAccount(publicKey)
            .cursor(latestCursor)
            .limit(10)
            .call()

          for (const record of page.records) {
            if (!existingHashes.has(record.hash)) {
              const tx: Transaction = {
                id: generateTransactionId(),
                type: record.source_account === publicKey ? 'send' : 'receive',
                amount: 0, // We would normally parse operations to get the exact amount
                asset: 'XLM',
                address: record.source_account,
                date: isoToDisplayDate(record.created_at || new Date().toISOString()),
                status: record.successful ? 'completed' : 'failed',
                category: 'transfer',
                name: 'Network Sync',
                stellarHash: record.hash,
              }
              await db.saveTransaction(tx)
              added++
            }
            latestCursor = record.paging_token
          }
        } catch (e: any) {
          if (e.response?.status !== 404) {
            failed++
          }
        }

        const pendingCount = await db.countPending()
        if (pendingCount > 0) {
          const allTxs = await db.getTransactions()
          for (const tx of allTxs.filter(t => t.status === 'pending')) {
            if (!tx.stellarHash) continue
            try {
              const record = await server.transactions().transaction(tx.stellarHash).call()
              const newStatus = record.successful ? 'completed' : 'failed'
              if (await db.updateTransactionStatus(tx.id, newStatus)) {
                updated++
              }
            } catch (e: any) {
              if (e.response?.status !== 404) {
                // If it's not 404, there's a real error. If 404, it remains pending.
                failed++
              }
            }
          }
        }

        db.recordSync(added, latestCursor !== '0' ? latestCursor : undefined)
        const lastSyncAt = new Date().toISOString()
        return { added, updated, failed, lastSyncAt }
      } finally {
        this.isSyncing = false
      }
    })
  }

  getLastSyncTime(): string | null {
    return db.getSyncState().lastSyncAt
  }

  getSyncStatus(): TransactionSyncStatus {
    const state = db.getSyncState()
    return {
      lastSyncAt: state.lastSyncAt,
      isSyncing: this.isSyncing,
      totalSynced: state.totalSynced,
      pendingCount: 0,
    }
  }

  async getRecentTransactions(limit = 10): Promise<Transaction[]> {
    return this.withPerformanceTracking('TransactionSyncService.getRecentTransactions', async () => {
      const page = await db.queryTransactions({ limit, offset: 0, sortBy: 'date', sortOrder: 'desc' })
      return page.data
    })
  }

  async addTransaction(req: AddTransactionRequest): Promise<Transaction> {
    return this.withPerformanceTracking('TransactionSyncService.addTransaction', async () => {
      const now = new Date().toISOString()
      const tx: Transaction = {
        id: generateTransactionId(),
        type: req.type,
        amount: req.amount,
        asset: req.asset,
        address: req.address,
        date: isoToDisplayDate(now),
        status: 'pending',
        category: req.category,
        name: req.name,
        detail: req.detail,
        currency: req.currency,
        stellarHash: req.stellarHash,
      }
      await db.saveTransaction(tx)
      return tx
    })
  }
}

export const transactionSyncService = new TransactionSyncService()
