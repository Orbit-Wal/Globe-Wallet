import { IStellarService, StellarAccount, OffRampMethod, CurrencyCode, StellarServiceError, WalletAccount, ClaimableBalance, TransactionResult } from '../types'
import { OFF_RAMP_RATES } from '../fixtures'
import { formatAddress } from '../helpers/format'
import { db } from '../db/mock-db'

/**
 * Stellar network helpers. Account-scoped methods accept an optional
 * `accountId` and default to the active/primary wallet account.
 */
export class StellarService implements IStellarService {
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
      throw new StellarServiceError(
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
      throw new StellarServiceError(
        err instanceof Error ? err.message : 'No wallet account available',
      )
    }
  }

  generateReceiveAddress(accountId?: string): string {
    return this.getAccountInfo(accountId).publicKey
  }

  validateAddress(address: string): boolean {
    // Basic Stellar address validation
    if (!address || typeof address !== 'string') return false
    if (address.length !== 56) return false
    if (!address.startsWith('G')) return false
    
    // Simple regex check for valid characters
    const stellarRegex = /^G[A-Z2-7]{55}$/
    return stellarRegex.test(address)
  }

  shortenKey(key: string, lead = 6, tail = 6): string {
    return formatAddress(key, lead, tail)
  }

  getOffRampMethods(): OffRampMethod[] {
    return [
      {
        id: 'm1',
        name: 'Bank Transfer (NGN)',
        description: 'Withdraw to any Nigerian bank account',
        currency: 'NGN',
        minAmount: 1000,
        maxAmount: 5000000,
        processingTime: 'Instant - 1 hour',
        fee: 100
      },
      {
        id: 'm2',
        name: 'SEPA Transfer (EUR)',
        description: 'Withdraw to European bank account',
        currency: 'EUR',
        minAmount: 10,
        maxAmount: 50000,
        processingTime: '1 - 2 business days',
        fee: 1.5
      },
      {
        id: 'm3',
        name: 'ACH Transfer (USD)',
        description: 'Withdraw to US bank account',
        currency: 'USD',
        minAmount: 20,
        maxAmount: 100000,
        processingTime: '2 - 3 business days',
        fee: 2.0
      }
    ]
  }

  getOffRampRate(currency: CurrencyCode): number {
    const rate = OFF_RAMP_RATES[currency]
    if (!rate) {
      throw new StellarServiceError(`Off-ramp rate not available for ${currency}`)
    }
    return rate
  }

  // ── Claimable Balances (Issue #99) ───────────────────────────────────────

  listClaimableBalances(accountId?: string): ClaimableBalance[] {
    try {
      const account = db.resolveAccountSync(accountId)
      const balances = db.getClaimableBalancesByAccountSync(account.publicKey)
      return balances.map(b => ({
        id: b.id,
        balanceId: b.balanceId,
        asset: b.asset,
        amount: b.amount,
        claimants: b.claimants.map(c => ({
          destination: c.destination,
          predicate: c.predicate ? JSON.parse(c.predicate) as any : undefined,
        })),
        sponsor: b.sponsor,
        status: b.status,
        createdAt: b.createdAt,
        memo: b.memo,
        memoType: b.memoType,
      }))
    } catch (err) {
      throw new StellarServiceError(
        err instanceof Error ? err.message : 'Failed to list claimable balances',
      )
    }
  }

  claimBalance(balanceId: string, accountId?: string): TransactionResult {
    try {
      const account = db.resolveAccountSync(accountId)
      const result = db.claimClaimableBalanceSync(balanceId, account.publicKey)
      return result
    } catch (err) {
      throw new StellarServiceError(
        err instanceof Error ? err.message : 'Failed to claim balance',
      )
    }
  }

  hasClaimableBalances(address: string): boolean {
    const balances = db.getClaimableBalancesByAccountSync(address)
    return balances.length > 0
  }
}

