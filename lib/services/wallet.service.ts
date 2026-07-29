import { IWalletService, StellarAccount, Balance, Transaction, TransactionResult, AssetCode, StellarServiceError, WalletServiceError, Trustline, TrustlineResult, WalletAccount, ClaimableBalance } from '../types'
import { MOCK_CRYPTO_ASSETS, SUPPORTED_STELLAR_ASSETS } from '../fixtures'
import { formatAddress } from '../helpers/format'
import { BaseService } from './base.service'
import { db } from '../db/mock-db'
import { context, injectTraceHeaders } from '../tracing/tracer'

/**
 * Level 2 Architecture Sync: Wallet Service
 * Implements simulated Stellar account operations with persistence.
 *
 * Multi-account: every account-scoped method accepts an optional `accountId`.
 * When omitted, operations target the active account (falling back to primary).
 */
export class WalletService extends BaseService implements IWalletService {
    constructor() {
        super('WalletService')
    }

    listAccounts(userId?: string): WalletAccount[] {
        return db.listAccountsSync(userId)
    }

    getActiveAccountId(): string | null {
        return db.getActiveAccountSync()?.id ?? null
    }

    switchAccount(accountId: string): WalletAccount {
        try {
            return db.setActiveAccountSync(accountId)
        } catch (err) {
            throw new WalletServiceError(
                err instanceof Error ? err.message : `Unknown wallet account: ${accountId}`,
            )
        }
    }

    getAccountInfo(accountId?: string): StellarAccount {
        try {
            const account = db.resolveAccountSync(accountId)
            return {
                id: account.id,
                publicKey: account.publicKey,
                name: account.name,
                network: account.network,
                isFunded: account.isFunded,
            }
        } catch (err) {
            throw new WalletServiceError(
                err instanceof Error ? err.message : 'No wallet account available',
            )
        }
    }

    async getBalance(_accountId?: string): Promise<Balance[]> {
        return this.withPerformanceTracking('getBalance', async () => {
            // Account id reserved for per-account balances once the store is
            // partitioned; trustlines remain shared in the mock for now.
            void _accountId
            const trustlines = await db.getTrustlines();
            const balances: Balance[] = [];

            for (const tl of trustlines) {
                const assetFixture = MOCK_CRYPTO_ASSETS.find(a => a.code === tl.asset);
                const supportedAsset = SUPPORTED_STELLAR_ASSETS.find(a => a.code === tl.asset);
                
                if (assetFixture) {
                    balances.push({
                        asset: assetFixture.code as AssetCode,
                        amount: assetFixture.balance,
                        priceUsd: assetFixture.priceUsd
                    });
                } else if (supportedAsset) {
                    balances.push({
                        asset: supportedAsset.code as AssetCode,
                        amount: 0,
                        priceUsd: supportedAsset.code === 'XLM' ? 0.1185 : 1.0 
                    });
                }
            }

            return balances;
        })
    }

    async getTrustlines(_accountId?: string): Promise<Trustline[]> {
        return this.withPerformanceTracking('getTrustlines', async () => {
            void _accountId
            return db.getTrustlines();
        });
    }

    async changeTrustline(asset: AssetCode, action: 'add' | 'remove', accountId?: string): Promise<TrustlineResult> {
        return this.withPerformanceTracking('changeTrustline', async () => {
            try {
                // Ensure the requested account exists before mutating trustlines.
                await db.resolveAccount(accountId)

                if (asset === 'XLM') {
                    throw new WalletServiceError("Cannot change trustline for native asset (XLM)");
                }

                const supportedAsset = SUPPORTED_STELLAR_ASSETS.find(a => a.code === asset);
                if (!supportedAsset) {
                    throw new WalletServiceError(`Asset ${asset} is not supported`);
                }

                const hasTrustline = await db.hasTrustline(asset);

                if (action === 'add') {
                    if (hasTrustline) {
                        throw new WalletServiceError(`Trustline for ${asset} already exists`);
                    }
                    await db.addTrustline(asset, supportedAsset.issuer);
                } else if (action === 'remove') {
                    if (!hasTrustline) {
                        throw new WalletServiceError(`Trustline for ${asset} does not exist`);
                    }
                    
                    const balances = await this.getBalance(accountId);
                    const assetBalance = balances.find(b => b.asset === asset);
                    if (assetBalance && assetBalance.amount > 0) {
                        throw new WalletServiceError(`Cannot remove trustline for ${asset} because it has a non-zero balance`);
                    }
                    
                    await db.removeTrustline(asset);
                }

                return {
                    success: true,
                    asset,
                    action,
                    reserveImpact: 0.5 // 0.5 XLM per trustline
                };
            } catch (err) {
                this.handleError(err, 'changeTrustline');
            }
        });
    }

    async sendPayment(destination: string, amount: number, asset: AssetCode, memo?: string, accountId?: string): Promise<TransactionResult> {
        return this.withPerformanceTracking('sendPayment', async () => {
            // Issue #103: captured synchronously, before the first `await` below —
            // this codebase has no Zone.js/AsyncLocalStorage in the browser, so
            // context.active() would no longer reflect this span once we resume
            // after awaiting. Capturing it now and forwarding it explicitly to
            // injectTraceHeaders() keeps propagation correct regardless of how
            // many awaits happen in between.
            const traceContext = context.active()

            try {
                await db.resolveAccount(accountId)

                if (amount <= 0) {
                    throw new WalletServiceError("Amount must be greater than zero")
                }

                if (!this.validateAddress(destination)) {
                    throw new StellarServiceError("Invalid destination address")
                }

                // Propagate the captured trace context (traceparent/tracestate) so
                // /api/wallet/send can continue this trace instead of starting a new one.
                const headers = injectTraceHeaders({ 'Content-Type': 'application/json' }, traceContext)
                const response = await fetch('/api/wallet/send', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ destination, amount, asset, memo, accountId })
                })

                if (!response.ok) {
                    const errBody = await response.json().catch(() => ({}))
                    throw new StellarServiceError(errBody.error || "Payment verification failed")
                }

                const result = await response.json() as TransactionResult

                // Persist whatever the network actually reported — a route that
                // rejected or couldn't confirm the payment must not be recorded
                // as if it had completed (see Issue #63).
                await db.saveTransaction({
                    id: Math.floor(Math.random() * 1000000).toString(),
                    type: 'send',
                    amount,
                    asset,
                    address: destination,
                    date: 'Just now',
                    status: result.status ?? (result.success ? 'completed' : 'failed'),
                    stellarHash: result.hash
                })

                return result
            } catch (err) {
                this.handleError(err, 'sendPayment')
            }
        })
    }

    generateReceiveAddress(accountId?: string): string {
        try {
            return db.resolveAccountSync(accountId).publicKey
        } catch (err) {
            throw new WalletServiceError(
                err instanceof Error ? err.message : 'No wallet account available',
            )
        }
    }

    validateAddress(address: string): boolean {
        if (!address || typeof address !== 'string') return false
        if (address.length !== 56) return false
        if (!address.startsWith('G')) return false

        const stellarRegex = /^G[A-Z0-9]{55}$/i
        return stellarRegex.test(address)
    }

    async getTransactionHistory(_accountId?: string): Promise<Transaction[]> {
        void _accountId
        return db.getTransactions()
    }

    shortenKey(key: string, lead = 6, tail = 6): string {
        return formatAddress(key, lead, tail)
    }

    // ── Claimable Balances (Issue #99) ─────────────────────────────────────
    async listClaimableBalances(accountId?: string): Promise<ClaimableBalance[]> {
        return this.withPerformanceTracking('listClaimableBalances', async () => {
            await db.resolveAccount(accountId)
            return db.getClaimableBalances(accountId)
        })
    }

    async claimBalance(balanceId: string, accountId?: string): Promise<TransactionResult> {
        return this.withPerformanceTracking('claimBalance', async () => {
            const account = await db.resolveAccount(accountId)
            return db.claimClaimableBalance(balanceId, account.publicKey)
        })
    }

    async hasClaimableBalances(address: string): Promise<boolean> {
        const balances = await db.getClaimableBalancesByAccount(address)
        return balances.length > 0
    }
}
