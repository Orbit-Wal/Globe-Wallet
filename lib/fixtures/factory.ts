import type {
  Balance,
  Transaction,
  Wallet,
  CryptoAsset,
  Contact,
  SavingsGoal,
  PaymentCard,
  AssetCode,
  CurrencyCode,
  TransactionCategory,
  StellarAccount,
  ClaimableBalance,
} from '../types'
import { MOCK_BALANCES } from './balances'
import { MOCK_TRANSACTIONS, MOCK_TRANSACTIONS_COMPACT } from './transactions'
import { MOCK_WALLETS } from './wallets'
import { MOCK_CRYPTO_ASSETS } from './assets'
import { MOCK_CONTACTS } from './contacts'
import { MOCK_CONVERSION_RATES, MOCK_SIMPLE_RATES } from './rates'
import { MOCK_STELLAR_ACCOUNT, TEST_STELLAR_ADDRESS } from './stellar'
import { MOCK_SAVINGS_GOALS } from './savings'
import { MOCK_PAYMENT_CARDS } from './cards'
import { MOCK_CLAIMABLE_BALANCES } from './claimable-balances'

let counter = 0
function uid(prefix = 'gen'): string {
  counter += 1
  return `${prefix}-${counter}`
}

function optional<T>(value: T, probability = 0.5): T | undefined {
  return Math.random() < probability ? value : undefined
}

function stellarHash(): string {
  return `0x${Math.random().toString(16).slice(2, 66)}`
}

function randomAsset(): AssetCode {
  const assets: AssetCode[] = ['XLM', 'USDC', 'USDT']
  return assets[Math.floor(Math.random() * assets.length)]
}

function randomCurrency(): CurrencyCode {
  const currencies: CurrencyCode[] = ['NGN', 'USD', 'EUR', 'GBP']
  return currencies[Math.floor(Math.random() * currencies.length)]
}

function randomCategory(): TransactionCategory {
  const categories: TransactionCategory[] = ['payment', 'exchange', 'withdrawal', 'deposit', 'transfer', 'airtime', 'bills', 'savings', 'card']
  return categories[Math.floor(Math.random() * categories.length)]
}

/**
 * FixtureFactory
 *
 * Centralized mock data generation service. Provides both static
 * pre-defined fixtures (the "golden data") and dynamic factory
 * methods for tests that need varying or edge-case data.
 *
 * All methods are pure (seeded via optional overrides) and produce
 * fully typed domain models.
 */
export const FixtureFactory = {
  resetCounter(): void {
    counter = 0
  },

  // ── Static (golden) data accessors ──────────────────────────────────────

  getBalances(): Balance[] {
    return MOCK_BALANCES.map((b) => ({ ...b }))
  },

  getTransactions(): Transaction[] {
    return MOCK_TRANSACTIONS.map((t) => ({ ...t }))
  },

  getTransactionsCompact(): Transaction[] {
    return MOCK_TRANSACTIONS_COMPACT.map((t) => ({ ...t }))
  },

  getWallets(): Wallet[] {
    return MOCK_WALLETS.map((w) => ({ ...w }))
  },

  getCryptoAssets(): CryptoAsset[] {
    return MOCK_CRYPTO_ASSETS.map((a) => ({ ...a }))
  },

  getContacts(): Contact[] {
    return MOCK_CONTACTS.map((c) => ({ ...c }))
  },

  getSavingsGoals(): SavingsGoal[] {
    return MOCK_SAVINGS_GOALS.map((g) => ({ ...g }))
  },

  getPaymentCards(): PaymentCard[] {
    return MOCK_PAYMENT_CARDS.map((c) => ({ ...c }))
  },

  getConversionRates() {
    return { ...MOCK_CONVERSION_RATES }
  },

  getSimpleRates() {
    return { ...MOCK_SIMPLE_RATES }
  },

  getStellarAccount(): StellarAccount {
    return { ...MOCK_STELLAR_ACCOUNT }
  },

  getTestStellarAddress(): string {
    return TEST_STELLAR_ADDRESS
  },

  getXlmUsdRate(): number {
    return 0.1185
  },

  getClaimableBalances(): ClaimableBalance[] {
    return MOCK_CLAIMABLE_BALANCES.map((b) => ({ ...b }))
  },

  getClaimableBalanceCount(): number {
    return MOCK_CLAIMABLE_BALANCES.length
  },

  // ── Dynamic factory methods ────────────────────────────────────────────

  createBalance(overrides: Partial<Balance> = {}): Balance {
    return {
      asset: overrides.asset ?? randomAsset(),
      amount: overrides.amount ?? Math.random() * 10000,
      priceUsd: overrides.priceUsd ?? Math.random() * 2,
    }
  },

  createTransaction(overrides: Partial<Transaction> = {}): Transaction {
    return {
      id: overrides.id ?? uid('tx'),
      type: overrides.type ?? 'send',
      amount: overrides.amount ?? Math.random() * 5000,
      asset: overrides.asset ?? randomAsset(),
      address: overrides.address ?? TEST_STELLAR_ADDRESS,
      date: overrides.date ?? new Date().toISOString(),
      status: overrides.status ?? 'completed',
      category: overrides.category ?? randomCategory(),
      name: overrides.name ?? optional('Mock Transaction', 0.3),
      detail: overrides.detail,
      stellarHash: overrides.stellarHash ?? stellarHash(),
      currency: overrides.currency,
    }
  },

  createWallet(overrides: Partial<Wallet> = {}): Wallet {
    const code = overrides.code ?? randomCurrency()
    return {
      id: overrides.id ?? uid('w'),
      code,
      name: overrides.name ?? `${code} Wallet`,
      balance: overrides.balance ?? Math.random() * 100000,
      color: overrides.color ?? 'bg-primary',
      changePct: overrides.changePct,
      label: overrides.label ?? code,
      symbol: overrides.symbol,
    }
  },

  createContact(overrides: Partial<Contact> = {}): Contact {
    const name = overrides.name ?? 'Test User'
    return {
      id: overrides.id ?? uid('c'),
      name,
      handle: overrides.handle ?? `@${name.toLowerCase().replace(/\s/g, '')}`,
      initials: overrides.initials ?? name.slice(0, 2).toUpperCase(),
      address: overrides.address,
    }
  },

  createSavingsGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
    return {
      id: overrides.id ?? uid('sg'),
      title: overrides.title ?? 'Test Goal',
      saved: overrides.saved ?? 0,
      target: overrides.target ?? 1000,
      currency: overrides.currency ?? randomCurrency(),
      apy: overrides.apy ?? 5,
      color: overrides.color ?? 'bg-primary',
    }
  },

  createPaymentCard(overrides: Partial<PaymentCard> = {}): PaymentCard {
    return {
      id: overrides.id ?? uid('card'),
      label: overrides.label ?? 'Test Card',
      type: overrides.type ?? 'virtual',
      brand: overrides.brand ?? 'Visa',
      last4: overrides.last4 ?? '1234',
      expiry: overrides.expiry ?? '12/28',
      balance: overrides.balance ?? 5000,
      currency: overrides.currency ?? 'USD',
      frozen: overrides.frozen ?? false,
      gradient: overrides.gradient ?? 'from-primary to-accent',
    }
  },

  createClaimableBalance(overrides: Partial<ClaimableBalance> = {}): ClaimableBalance {
    return {
      id: overrides.id ?? uid('cb'),
      balanceId: overrides.balanceId ?? '0x' + Math.random().toString(16).slice(2, 66),
      asset: overrides.asset ?? randomAsset(),
      amount: overrides.amount ?? Math.random() * 1000,
      claimants: overrides.claimants ?? [{ destination: TEST_STELLAR_ADDRESS }],
      status: overrides.status ?? 'available',
      createdAt: overrides.createdAt ?? new Date().toISOString(),
      sponsor: overrides.sponsor,
      memo: overrides.memo,
      memoType: overrides.memoType,
    }
  },

  // ── Batch / scenario helpers ────────────────────────────────────────────

  /**
   * Creates a full mock portfolio — wallets, crypto, transactions, contacts.
   */
  createPortfolio() {
    return {
      wallets: MOCK_WALLETS.map((w) => ({ ...w })),
      cryptoAssets: MOCK_CRYPTO_ASSETS.map((a) => ({ ...a })),
      balances: MOCK_BALANCES.map((b) => ({ ...b })),
      transactions: MOCK_TRANSACTIONS.map((t) => ({ ...t })),
      contacts: MOCK_CONTACTS.map((c) => ({ ...c })),
      savingsGoals: MOCK_SAVINGS_GOALS.map((g) => ({ ...g })),
      paymentCards: MOCK_PAYMENT_CARDS.map((c) => ({ ...c })),
      rates: { ...MOCK_SIMPLE_RATES },
      stellarAccount: { ...MOCK_STELLAR_ACCOUNT },
    }
  },
}

