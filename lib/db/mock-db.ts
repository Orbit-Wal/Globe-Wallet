import { Transaction, TransactionFilters, TransactionPage, Trustline, AssetCode, WalletAccount, ClaimableBalance, TransactionResult } from '../types'
import {
  MOCK_STELLAR_ACCOUNT,
  MOCK_SECONDARY_STELLAR_ACCOUNT,
  MOCK_TRANSACTIONS_COMPACT,
} from '../fixtures'
import { filterAndSortTransactions } from '../transaction-utils'

interface UserSchema {
    id: string
    email: string
    password_hash: string
    kyc_status: 'pending' | 'verified' | 'rejected'
    created_at: string
}

interface WebAuthnCredentialSchema {
    id: string
    user_id: string
    credential_id: string
    public_key: string
    user_handle: string
    transports?: string[]
    counter: number
    created_at: string
}

interface RecoveryKeySchema {
    id: string
    user_id: string
    recovery_key_hash: string
    created_at: string
}

interface WalletAccountSchema {
    id: string
    user_id: string
    public_key: string
    encrypted_private_key: string
    account_type: 'standard' | 'premium'
    name: string
    network: string
    is_funded: boolean
    is_primary: boolean
    is_active: boolean
    created_at: string
}

interface SyncState {
    lastSyncAt: string | null
    totalSynced: number
    lastSyncCursor: string | null
}

interface ClaimableBalanceSchema {
    id: string
    balanceId: string
    accountPublicKey: string
    asset: AssetCode
    amount: number
    claimants: { destination: string; predicate?: string }[]
    sponsor?: string
    createdAt: string
    claimedAt?: string
    memo?: string
    memoType?: string
    status: 'available' | 'claimed' | 'deleted'
}

const generateId = () => Math.random().toString(36).substr(2, 9)

function toWalletAccount(row: WalletAccountSchema): WalletAccount {
    return {
        id: row.id,
        userId: row.user_id,
        publicKey: row.public_key,
        name: row.name,
        accountType: row.account_type,
        isPrimary: row.is_primary,
        isActive: row.is_active,
        network: row.network,
        isFunded: row.is_funded,
        createdAt: row.created_at,
    }
}

class MockDB {
    private users: UserSchema[] = []
    private webAuthnCredentials: WebAuthnCredentialSchema[] = []
    private recoveryKeys: RecoveryKeySchema[] = []
    private walletAccounts: WalletAccountSchema[] = []
    private transactions: Transaction[] = []
    private txListeners: Set<(tx: Transaction) => void> = new Set()
    private trustlines: Trustline[] = []
    private syncState: SyncState = { lastSyncAt: null, totalSynced: 0, lastSyncCursor: null }
    private claimableBalances: ClaimableBalanceSchema[] = []
    private defaultUserId: string = ''

    constructor() {
        this.initializeDefaults()
    }

    private initializeDefaults() {
        const userId = generateId()
        this.defaultUserId = userId
        this.users.push({
            id: userId,
            email: 'user@globe.wallet',
            password_hash: 'argon2...hash',
            kyc_status: 'verified',
            created_at: new Date().toISOString(),
        })

        const primaryId = generateId()
        this.walletAccounts.push({
            id: primaryId,
            user_id: userId,
            public_key: MOCK_STELLAR_ACCOUNT.publicKey,
            encrypted_private_key: 'vault...key',
            account_type: 'standard',
            name: MOCK_STELLAR_ACCOUNT.name || 'Primary Wallet',
            network: MOCK_STELLAR_ACCOUNT.network || 'Stellar Public Network',
            is_funded: MOCK_STELLAR_ACCOUNT.isFunded,
            is_primary: true,
            is_active: true,
            created_at: new Date().toISOString(),
        })

        this.walletAccounts.push({
            id: generateId(),
            user_id: userId,
            public_key: MOCK_SECONDARY_STELLAR_ACCOUNT.publicKey,
            encrypted_private_key: 'vault...key-secondary',
            account_type: 'premium',
            name: MOCK_SECONDARY_STELLAR_ACCOUNT.name || 'Savings Wallet',
            network: MOCK_SECONDARY_STELLAR_ACCOUNT.network || 'Stellar Public Network',
            is_funded: MOCK_SECONDARY_STELLAR_ACCOUNT.isFunded,
            is_primary: false,
            is_active: false,
            created_at: new Date().toISOString(),
        })

        this.transactions = MOCK_TRANSACTIONS_COMPACT.map((tx) => ({ ...tx }))

        this.trustlines = [
            { asset: 'XLM', issuer: 'native', established: true, createdAt: new Date().toISOString() },
            { asset: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', established: true, createdAt: new Date().toISOString() },
            { asset: 'USDT', issuer: 'GCQTGZZZ5GNCIRERPBEWHDQO0TG3EFG5BHTO223UOM8F7B3I6T5B5E5W', established: true, createdAt: new Date().toISOString() },
        ]

        // Initialize mock claimable balances for the primary account (Issue #99)
        const primaryAccount = this.walletAccounts.find(w => w.is_primary)
        if (primaryAccount) {
            const primaryPublicKey = primaryAccount.public_key
            // Create a few mock claimable balances for testing
            this.claimableBalances.push(
                {
                    id: generateId(),
                    balanceId: '0x' + Math.random().toString(16).slice(2, 66),
                    accountPublicKey: primaryPublicKey,
                    asset: 'USDC',
                    amount: 100.5,
                    claimants: [{ destination: primaryPublicKey }],
                    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                    status: 'available',
                },
                {
                    id: generateId(),
                    balanceId: '0x' + Math.random().toString(16).slice(2, 66),
                    accountPublicKey: primaryPublicKey,
                    asset: 'XLM',
                    amount: 500,
                    claimants: [{ destination: primaryPublicKey }],
                    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
                    status: 'available',
                },
            )
        }
    }

    getDefaultUserId(): string {
        return this.defaultUserId
    }

    async getUser(email: string): Promise<UserSchema | undefined> {
        return this.users.find(u => u.email === email)
    }

    async getAccountByPublicKey(publicKey: string): Promise<WalletAccountSchema | undefined> {
        return this.walletAccounts.find(w => w.public_key === publicKey)
    }

    getAccountByIdSync(accountId: string): WalletAccount | undefined {
        const row = this.walletAccounts.find(w => w.id === accountId)
        return row ? toWalletAccount(row) : undefined
    }

    async getAccountById(accountId: string): Promise<WalletAccount | undefined> {
        return this.getAccountByIdSync(accountId)
    }

    listAccountsSync(userId?: string): WalletAccount[] {
        const uid = userId ?? this.defaultUserId
        return this.walletAccounts
            .filter(w => w.user_id === uid)
            .map(toWalletAccount)
    }

    async listAccounts(userId?: string): Promise<WalletAccount[]> {
        return this.listAccountsSync(userId)
    }

    getPrimaryAccountSync(userId?: string): WalletAccount | undefined {
        const uid = userId ?? this.defaultUserId
        const primary = this.walletAccounts.find(w => w.user_id === uid && w.is_primary)
        if (primary) return toWalletAccount(primary)
        const first = this.walletAccounts.find(w => w.user_id === uid)
        return first ? toWalletAccount(first) : undefined
    }

    async getPrimaryAccount(userId?: string): Promise<WalletAccount | undefined> {
        return this.getPrimaryAccountSync(userId)
    }

    getActiveAccountSync(userId?: string): WalletAccount | undefined {
        const uid = userId ?? this.defaultUserId
        const active = this.walletAccounts.find(w => w.user_id === uid && w.is_active)
        if (active) return toWalletAccount(active)
        return this.getPrimaryAccountSync(uid)
    }

    async getActiveAccount(userId?: string): Promise<WalletAccount | undefined> {
        return this.getActiveAccountSync(userId)
    }

    /**
     * Resolve an account by id, or fall back to the active → primary account.
     * Throws when the id is unknown so callers fail loudly instead of silently
     * operating on the wrong wallet.
     */
    resolveAccountSync(accountId?: string, userId?: string): WalletAccount {
        if (accountId) {
            const found = this.getAccountByIdSync(accountId)
            if (!found) {
                throw new Error(`Unknown wallet account: ${accountId}`)
            }
            return found
        }
        const active = this.getActiveAccountSync(userId)
        if (!active) {
            throw new Error('No wallet account available')
        }
        return active
    }

    async resolveAccount(accountId?: string, userId?: string): Promise<WalletAccount> {
        return this.resolveAccountSync(accountId, userId)
    }

    setActiveAccountSync(accountId: string, userId?: string): WalletAccount {
        const uid = userId ?? this.defaultUserId
        const target = this.walletAccounts.find(w => w.id === accountId && w.user_id === uid)
        if (!target) {
            throw new Error(`Unknown wallet account: ${accountId}`)
        }
        for (const account of this.walletAccounts) {
            if (account.user_id === uid) {
                account.is_active = account.id === accountId
            }
        }
        return toWalletAccount(target)
    }

    async setActiveAccount(accountId: string, userId?: string): Promise<WalletAccount> {
        return this.setActiveAccountSync(accountId, userId)
    }

    async getTransactions(): Promise<Transaction[]> {
        return [...this.transactions]
    }

    async queryTransactions(filters: TransactionFilters = {}): Promise<TransactionPage> {
        const { limit = 20, offset = 0, ...rest } = filters
        const allFiltered = filterAndSortTransactions([...this.transactions], rest)
        const total = allFiltered.length
        const data = allFiltered.slice(offset, offset + limit)
        return { data, total, offset, limit, hasMore: offset + data.length < total }
    }

    async getTransactionById(id: string): Promise<Transaction | undefined> {
        return this.transactions.find(t => t.id === id)
    }

    async saveTransaction(tx: Transaction): Promise<void> {
        this.transactions.unshift(tx)
        // Notify any subscribed listeners of the new transaction
        this.txListeners.forEach((cb) => {
            try {
                cb(tx)
            } catch (e) {
                // swallow listener errors to avoid breaking DB flow
            }
        })
    }

    async updateTransactionStatus(id: string, status: Transaction['status']): Promise<boolean> {
        const tx = this.transactions.find(t => t.id === id)
        if (!tx) return false
        tx.status = status
        return true
    }

    async countPending(): Promise<number> {
        return this.transactions.filter(t => t.status === 'pending').length
    }

    getSyncState(): SyncState {
        return { ...this.syncState }
    }

    recordSync(added: number, newCursor?: string): void {
        this.syncState.lastSyncAt = new Date().toISOString()
        this.syncState.totalSynced += added
        if (newCursor) {
            this.syncState.lastSyncCursor = newCursor
        }
    }

    /**
     * Subscribe to real‑time transaction events.
     * Returns an unsubscribe function.
     */
    subscribeToTransactions(callback: (tx: Transaction) => void): () => void {
        this.txListeners.add(callback)
        return () => {
            this.txListeners.delete(callback)
        }
    }

    async getTrustlines(): Promise<Trustline[]> {
        return [...this.trustlines]
    }

    async addTrustline(asset: AssetCode, issuer: string): Promise<void> {
        if (!this.trustlines.find(t => t.asset === asset)) {
            this.trustlines.push({
                asset,
                issuer,
                established: true,
                createdAt: new Date().toISOString()
            })
        }
    }

    async removeTrustline(asset: AssetCode): Promise<void> {
        this.trustlines = this.trustlines.filter(t => t.asset !== asset)
    }

    async hasTrustline(asset: AssetCode): Promise<boolean> {
        return this.trustlines.some(t => t.asset === asset)
    }

    async getWebAuthnCredentialsByUserId(userId: string): Promise<WebAuthnCredentialSchema[]> {
        return this.webAuthnCredentials.filter(c => c.user_id === userId)
    }

    async getWebAuthnCredentialById(credentialId: string): Promise<WebAuthnCredentialSchema | undefined> {
        return this.webAuthnCredentials.find(c => c.credential_id === credentialId)
    }

    async saveWebAuthnCredential(credential: Omit<WebAuthnCredentialSchema, 'id' | 'created_at'>): Promise<void> {
        this.webAuthnCredentials.push({
            id: generateId(),
            ...credential,
            created_at: new Date().toISOString(),
        })
    }

    async updateWebAuthnCredentialCounter(credentialId: string, counter: number): Promise<boolean> {
        const cred = this.webAuthnCredentials.find(c => c.credential_id === credentialId)
        if (!cred) return false
        cred.counter = counter
        return true
    }

    async getRecoveryKeysByUserId(userId: string): Promise<RecoveryKeySchema[]> {
        return this.recoveryKeys.filter(k => k.user_id === userId)
    }

    async saveRecoveryKey(recoveryKey: Omit<RecoveryKeySchema, 'id' | 'created_at'>): Promise<void> {
        this.recoveryKeys.push({
            id: generateId(),
            ...recoveryKey,
            created_at: new Date().toISOString(),
        })
    }

    // ── Claimable Balances (Issue #99) ─────────────────────────────────────

    getClaimableBalancesByAccountSync(publicKey: string): ClaimableBalanceSchema[] {
        return this.claimableBalances.filter(b => b.accountPublicKey === publicKey)
    }

    async getClaimableBalancesByAccount(publicKey: string): Promise<ClaimableBalanceSchema[]> {
        return this.getClaimableBalancesByAccountSync(publicKey)
    }

    async getClaimableBalances(accountId?: string): Promise<ClaimableBalance[]> {
        const account = await this.resolveAccount(accountId)
        const dbBalances = this.claimableBalances.filter(b => b.accountPublicKey === account.publicKey)
        return dbBalances.map(b => ({
            id: b.id,
            balanceId: b.balanceId,
            asset: b.asset,
            amount: b.amount,
            claimants: b.claimants.map(c => ({
                destination: c.destination,
                predicate: c.predicate ? JSON.parse(c.predicate) : undefined,
            })),
            sponsor: b.sponsor,
            status: b.status,
            createdAt: b.createdAt,
            memo: b.memo,
            memoType: b.memoType,
        }))
    }

    claimClaimableBalanceSync(balanceId: string, claimantPublicKey: string): TransactionResult {
        const balance = this.claimableBalances.find(b => b.balanceId === balanceId)
        if (!balance) {
            return { success: false, error: 'Claimable balance not found' }
        }

        if (balance.status !== 'available') {
            return { success: false, error: 'Claimable balance is not available' }
        }

        const claimant = balance.claimants.find(c => c.destination === claimantPublicKey)
        if (!claimant) {
            return { success: false, error: 'You are not authorized to claim this balance' }
        }

        // Mark as claimed
        balance.status = 'claimed'
        balance.claimedAt = new Date().toISOString()

        // Create a transaction entry
        const tx: Transaction = {
            id: Math.floor(Math.random() * 1000000).toString(),
            type: 'receive',
            amount: balance.amount,
            asset: balance.asset,
            address: balance.accountPublicKey,
            date: new Date().toISOString(),
            status: 'completed',
            stellarHash: `claim:${balanceId}`,
            category: 'deposit' as const,
            name: `Claimed ${balance.asset} balance`,
            detail: `Claimed ${balance.amount} ${balance.asset} from claimable balance`,
        }

        this.transactions.unshift(tx)

        return {
            success: true,
            hash: `claim:${balanceId}`,
            status: 'completed',
        }
    }

    async claimClaimableBalance(balanceId: string, claimantPublicKey: string): Promise<TransactionResult> {
        return this.claimClaimableBalanceSync(balanceId, claimantPublicKey)
    }
}

export const db = new MockDB()

