/**
 * Issue #18 Enterprise Upgrade — Type System
 * Expanded and synced with architecture.md, issue-18.md, and all service layers.
 */

export type AssetCode = "XLM" | "USDC" | "USDT";
export type CurrencyCode = "NGN" | "USD" | "EUR" | "GBP";
export type TransactionDirection = "in" | "out";

// ── Claimable Balances (Issue #99) ───────────────────────────────────────────

/** Status of a claimable balance on the Stellar network */
export type ClaimableBalanceStatus = "available" | "claimed" | "deleted";

/** Claimant definition for a claimable balance */
export interface Claimant {
  destination: string;
  /** Predicate for vesting conditions */
  predicate?: ClaimableBalancePredicate;
}

/** Predicate for claimable balance vesting conditions */
export interface ClaimableBalancePredicate {
  /** Unix timestamp for time-based vesting */
  simpleTime?: string;
  /** Simple relative time in seconds from now */
  simpleRelative?: number;
}

/** A claimable balance on the Stellar network */
export interface ClaimableBalance {
  id: string;
  balanceId: string;
  asset: AssetCode;
  amount: number;
  claimants: Claimant[];
  sponsor?: string;
  status: ClaimableBalanceStatus;
  createdAt: string;
  memo?: string;
  memoType?: string;
}

export type TransactionCategory =
  | "payment"
  | "exchange"
  | "withdrawal"
  | "deposit"
  | "transfer"
  | "airtime"
  | "bills"
  | "savings"
  | "card";

// ── Domain Models ───────────────────────────────────────────────────────────

export interface StellarAccount {
  /** Stable wallet-account id when resolved from the multi-account store */
  id?: string;
  publicKey: string;
  name: string;
  network: string;
  isFunded: boolean;
}

/** Persisted Stellar wallet account belonging to a user (supports multi-account). */
export interface WalletAccount {
  id: string;
  userId: string;
  publicKey: string;
  name: string;
  accountType: "standard" | "premium";
  /** Primary account used when no accountId is supplied */
  isPrimary: boolean;
  /** Currently selected account for wallet/sync operations */
  isActive: boolean;
  network: string;
  isFunded: boolean;
  createdAt: string;
}

export interface Wallet {
  id: string;
  name: string;
  /** Display label; defaults to `name` in UI helpers */
  label?: string;
  code: CurrencyCode;
  balance: number;
  color: string;
  /** Weekly change percentage, optional legacy field */
  changePct?: number;
  symbol?: string;
}

export interface CryptoAsset {
  code: AssetCode;
  name: string;
  balance: number;
  priceUsd: number;
  change24h: number;
  /** UI alias for 24h change percentage */
  changePct?: number;
  color: string;
}

export interface Contact {
  id: string;
  name: string;
  handle: string;
  initials: string;
  address?: string;
}

/** Describes the state of the contact picker in the send form */
export interface ContactsState {
  contacts: Contact[];
  selected: Contact | null;
  query: string;
  loading: boolean;
}

/** Payload passed to the send confirmation step */
export interface SendConfirmation {
  recipient: string;
  recipientLabel?: string;
  amount: number;
  asset: AssetCode;
  memo?: string;
  estimatedFee: number;
  /** Set when recipient was resolved from a federated address (e.g. "alice*stellar.org") */
  federatedInput?: string;
  /** Memo surfaced from the federation record, shown in summary */
  federationMemo?: string;
}

/** Request body for /api/send */
export interface SendRequest {
  destination: string;
  amount: number;
  asset: AssetCode;
  memo?: string;
}

/** Response from /api/send */
export interface SendResponse {
  success: boolean;
  hash?: string;
  status?: "completed" | "pending" | "failed";
  error?: string;
}

export interface OffRampRequest {
  asset: AssetCode;
  amount: number;
  paymentMethodId: string;
  fiatAmount: number;
}

export interface OffRampResponse {
  success: boolean;
  data?: {
    methodId: string;
    methodName: string;
    asset: AssetCode;
    amount: number;
    fiatAmount: number;
    status?: "completed" | "pending" | "failed";
    hash?: string;
  };
  error?: string;
}

/** Payment request fields for receive / QR generation */
export interface PaymentRequest {
  address: string
  amount?: string
  memo?: string
  asset?: AssetCode
}

/** QR payload for address-only or payment-request tabs */
export interface ReceiveQRData {
  value: string
  type: 'address' | 'payment-request'
  address: string
  amount?: string
  memo?: string
}

/** Response from GET /api/receive */
export interface ReceiveAddressResponse {
  success: boolean
  address?: string
  error?: string
}

/** Request body for POST /api/receive (payment request) */
export interface PaymentRequestPayload {
  amount?: string
  memo?: string
  asset?: AssetCode
}

/** Response from POST /api/receive */
export interface PaymentRequestResponse {
  success: boolean
  address?: string
  qrValue?: string
  shareText?: string
  error?: string
}

/** Result of client-side payment amount validation */
export interface PaymentAmountValidation {
  valid: boolean
  error?: string
}

export interface SavingsGoal {
  id: string;
  title: string;
  saved: number;
  target: number;
  currency: CurrencyCode;
  apy: number;
  color: string;
}

export interface PaymentCard {
  id: string;
  label: string;
  type: "virtual" | "physical";
  brand: "Visa" | "Mastercard";
  last4: string;
  expiry: string;
  balance: number;
  currency: CurrencyCode;
  frozen: boolean;
  gradient: string;
}

export interface Trustline {
  asset: AssetCode;
  issuer: string;
  established: boolean;
  createdAt: string;
}

export interface TrustlineResult {
  success: boolean;
  asset: AssetCode;
  action: 'add' | 'remove';
  reserveImpact: number;
  error?: string;
}

export interface ChangeTrustRequest {
  asset: AssetCode;
  action: 'add' | 'remove';
}

export interface ChangeTrustResponse {
  success: boolean;
  data?: TrustlineResult;
  error?: string;
}

export interface Balance {
  asset: AssetCode;
  amount: number;
  priceUsd: number;
}

export interface Transaction {
  id: string;
  /** Crypto-style type used by WalletService */
  type: "send" | "receive" | "convert" | "withdraw" | "in" | "out";
  amount: number;
  asset: AssetCode;
  /** Fiat currency for the legacy TransactionList view */
  currency?: CurrencyCode;
  address: string;
  date: string;
  status: "completed" | "pending" | "failed";
  stellarHash?: string;
  /** Categorisation for filtering and display */
  category?: TransactionCategory;
  /** Human-readable display name for the transaction */
  name?: string;
  /** Additional transaction detail text */
  detail?: string;
}

export interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
  status?: "completed" | "pending" | "failed";
}

export interface ClaimRequest {
  balanceId: string;
  accountId?: string;
}

export interface ClaimResponse {
  success: boolean;
  hash?: string;
  status?: "completed" | "pending" | "failed";
  error?: string;
}

export interface ClaimableBalancesResponse {
  success: boolean;
  data?: {
    balances: ClaimableBalance[];
    totalAmount: number;
    count: number;
  };
  error?: string;
}

export interface FeeEstimate {
  base: number;
  network: number;
  total: number;
  asset: AssetCode;
  /** Estimated time in seconds */
  estimatedSeconds: number;
}

export interface OffRampMethod {
  id: string;
  name: string;
  description: string;
  currency: CurrencyCode;
  minAmount: number;
  maxAmount: number;
  processingTime: string;
  fee: number;
}

// ── Error Classes ────────────────────────────────────────────────────────────

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class StellarServiceError extends ServiceError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "StellarServiceError";
  }
}

export class WalletServiceError extends ServiceError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "WalletServiceError";
  }
}

export class OffRampServiceError extends ServiceError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "OffRampServiceError";
  }
}

export class AssetServiceError extends ServiceError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "AssetServiceError";
  }
}

export class FiatServiceError extends ServiceError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "FiatServiceError";
  }
}

// ── Service Interfaces ───────────────────────────────────────────────────────

export interface IWalletService {
  /** Resolve account info; omits accountId → active/primary account */
  getAccountInfo(accountId?: string): StellarAccount;
  /** All Stellar accounts for a user (defaults to the seeded demo user) */
  listAccounts(userId?: string): WalletAccount[];
  /** Id of the currently selected account */
  getActiveAccountId(): string | null;
  /** Switch the active account used by default for wallet operations */
  switchAccount(accountId: string): WalletAccount;
  getBalance(accountId?: string): Promise<Balance[]>;
  sendPayment(
    destination: string,
    amount: number,
    asset: AssetCode,
    memo?: string,
    accountId?: string,
  ): Promise<TransactionResult>;
  generateReceiveAddress(accountId?: string): string;
  validateAddress(address: string): boolean;
  getTransactionHistory(accountId?: string): Promise<Transaction[]>;
  shortenKey(key: string, lead?: number, tail?: number): string;
  getTrustlines(accountId?: string): Promise<Trustline[]>;
  changeTrustline(asset: AssetCode, action: 'add' | 'remove', accountId?: string): Promise<TrustlineResult>;
  // ── Claimable Balances (Issue #99) ─────────────────────────────────────
  listClaimableBalances(accountId?: string): Promise<ClaimableBalance[]>;
  claimBalance(balanceId: string, accountId?: string): Promise<TransactionResult>;
  hasClaimableBalances(address: string): Promise<boolean>;
}

export interface IPricingService {
  getAssets(): CryptoAsset[];
  getPrice(code: AssetCode): Promise<number>;
  formatAsset(amount: number, code: AssetCode, hidden?: boolean): string;
}

export interface IOffRampService {
  initiateWithdrawal(
    amount: number,
    asset: AssetCode,
    methodId: string,
    currency: CurrencyCode,
  ): Promise<TransactionResult>;
  getRates(): Promise<Record<string, number>>;
  getMethods(): OffRampMethod[];
}

/**
 * GlobeWallet Soroban contract types.
 * Sourced from contracts/soroban-spec.json (hand-maintained from Orbit-Wal/contract).
 */
export interface SorobanAssetInfo {
  code: string
  issuer?: string
}

export interface ISorobanService {
  /** Register a whitelisted asset for a user wallet. Max 50 assets. */
  addAsset(user: string, asset: SorobanAssetInfo): Promise<TransactionResult>
  /** Remove an asset from a user's wallet by asset code. */
  removeAsset(user: string, asset: SorobanAssetInfo): Promise<TransactionResult>
  /** Return the list of whitelisted assets for a user. */
  getAssets(user: string): Promise<SorobanAssetInfo[]>
  /** Set the daily spend limit (in stroops) for a specific asset. */
  setSpendLimit(user: string, asset: SorobanAssetInfo, limit: bigint): Promise<TransactionResult>
  /** Return the daily spend limit for a specific asset. */
  getSpendLimit(user: string, asset: SorobanAssetInfo): Promise<bigint>
  /** Record a spend and reject if it would exceed the daily limit. */
  recordSpend(user: string, asset: SorobanAssetInfo, amount: bigint): Promise<TransactionResult>
}

export interface IFiatService {
  getWallets(): Wallet[];
  formatMoney(amount: number, currency: CurrencyCode, hidden?: boolean): string;
  convertCurrency(from: CurrencyCode, to: CurrencyCode, amount: number): number;
  getAccountBalance(): number;
}

// ── Issue #11: Crypto-Native Send Flow / Federation Types ────────────────────

/** Resolution states for a Stellar federated address lookup */
export type AddressLookupStatus = 'idle' | 'resolving' | 'resolved' | 'not-found' | 'error'

/** Result returned by the federation lookup hook and service */
export interface AddressLookupResult {
  status: AddressLookupStatus
  /** The raw input string that was looked up */
  input: string
  /** The resolved G… Stellar public key (only when status === 'resolved') */
  resolved?: string
  /** Optional memo attached to the federation record */
  federationMemo?: string
  /** Human-readable error when status === 'error' */
  error?: string
}

/** A resolved Stellar federated address record */
export interface FederatedAddress {
  /** Original user input, e.g. "alice*stellar.org" */
  input: string
  /** Resolved G… public key */
  accountId: string
  memo?: string
  memoType?: 'text' | 'id' | 'hash'
}

export interface IFederationService {
  /** Returns true if the input looks like a federated address (user*domain.tld) */
  isFederated(input: string): boolean
  /** Resolve a federated address string to a public key + optional memo */
  lookup(federatedAddress: string): Promise<AddressLookupResult>
}

export interface MergeAnalyticsPayload {
  event: "merge";
  repository: string;
  branch: string;
  commit: string;
  timestamp: string;
  author: string;
  issue: number;
  status: "success" | "failure";
  coverage_verified: boolean;
}

export interface IAssetService {
  getAssets(): CryptoAsset[];
  getAssetPrice(code: AssetCode): Promise<number>;
  formatAsset(amount: number, code: AssetCode, hidden?: boolean): string;
  convertAsset(from: AssetCode, to: AssetCode, amount: number): number;
}

export interface IStellarService {
  /** Resolve account info; omits accountId → active/primary account */
  getAccountInfo(accountId?: string): StellarAccount;
  listAccounts(userId?: string): WalletAccount[];
  getActiveAccountId(): string | null;
  switchAccount(accountId: string): WalletAccount;
  generateReceiveAddress(accountId?: string): string;
  validateAddress(address: string): boolean;
  shortenKey(key: string, lead?: number, tail?: number): string;
  getOffRampMethods(): OffRampMethod[];
  getOffRampRate(currency: CurrencyCode): number;
  // ── Claimable Balances (Issue #99) ─────────────────────────────────────
  listClaimableBalances(accountId?: string): ClaimableBalance[];
  claimBalance(balanceId: string, accountId?: string): TransactionResult;
  hasClaimableBalances(address: string): boolean;
}

// ── Convert Page Types (Issue #20) ──────────────────────────────────────────

/**
 * Represents a single exchange rate entry as used on the convert page.
 * Mirrors the inline rate table in app/convert/page.tsx for testability.
 */
export interface ExchangeRateEntry {
  from: string
  to: string
  rate: number
  change24h: number
}

/**
 * Encapsulates the full UI state of the convert page.
 * Enables type-safe prop drilling and unit-testable state transitions.
 */
export interface ConversionState {
  fromAmount: string
  toAmount: string
  fromCurrency: string
  toCurrency: string
  isLoading: boolean
}

/**
 * Result returned by a conversion operation from the convert page.
 * Carries enough context for analytics or transaction history entries.
 */
export interface ConversionResult {
  fromAmount: number
  toAmount: number
  fromCurrency: string
  toCurrency: string
  rate: number
  processingFeeRate: number
  netReceived: number
  timestamp: string
}

// ── Path Payment Types (Issue #98) ───────────────────────────────────────────

export type PathPaymentMode = 'strictSend' | 'strictReceive'

export interface PaymentHopAsset {
  code: string
  issuer?: string
  type: string
}

export interface PaymentQuote {
  mode: PathPaymentMode
  sourceAsset: AssetCode
  destinationAsset: AssetCode
  executableSourceAmount: string
  executableDestinationAmount: string
  path: PaymentHopAsset[]
  estimatedPrice: number
  priceImpact: number | null
  slippageTolerance: number
  destMin: string
  sendMax: string
  expiresAt: number
  createdAt: number
  isStale?: boolean
}

export interface PathPaymentParams {
  sourceAsset: AssetCode
  destinationAsset: AssetCode
  amount: string
  mode: PathPaymentMode
  slippageTolerance?: number
  destinationAccount?: string
}

export interface ExecutePathPaymentParams {
  quote: PaymentQuote
  sourceSecretOrKeypair?: string
  destinationAccount?: string
}

export interface PathPaymentExecutionResult {
  success: boolean
  hash?: string
  ledger?: number
  error?: string
  sourceAmountPaid?: string
  destinationAmountReceived?: string
}

export interface IPathPaymentService {
  findQuote(params: PathPaymentParams): Promise<PaymentQuote>
  executePayment(params: ExecutePathPaymentParams): Promise<PathPaymentExecutionResult>
}

export class NoPathFoundError extends Error {
  constructor(message = 'No available conversion path found on Stellar network') {
    super(message)
    this.name = 'NoPathFoundError'
  }
}

export class SlippageExceededError extends Error {
  constructor(message = 'Execution amount exceeds configured slippage tolerance') {
    super(message)
    this.name = 'SlippageExceededError'
  }
}

export class StaleQuoteError extends Error {
  constructor(message = 'Quote has expired. Please refresh the quote before converting.') {
    super(message)
    this.name = 'StaleQuoteError'
  }
}

// ── Onboarding Types (Issue #29) ─────────────────────────────────────────────

/** Tracks completion of developer onboarding steps for new contributors. */
export interface OnboardingChecklist {
  /** Developer's name or GitHub handle */
  developer: string;
  /** Steps the developer has completed */
  completedSteps: OnboardingStep[];
  /** ISO timestamp of when onboarding was started */
  startedAt: string;
  /** ISO timestamp of when all steps were completed, if applicable */
  completedAt?: string;
}

export type OnboardingStep =
  | "repo-cloned"
  | "env-configured"
  | "dev-server-started"
  | "tests-run"
  | "first-pr-opened"
  | "docs-read";

/** Lightweight profile used to personalise the onboarding experience. */
export interface DeveloperProfile {
  handle: string;
  role: "frontend" | "backend" | "fullstack" | "qa" | "devops";
  /** Whether the developer prefers to see advanced architecture notes */
  advancedMode: boolean;
}

// ── Error Codes (Issue #104) ─────────────────────────────────────────────────

export const ErrorCodes = {
  ERR_INVALID_ADDRESS: 'ERR_INVALID_ADDRESS',
  ERR_INVALID_AMOUNT: 'ERR_INVALID_AMOUNT',
  ERR_MISSING_ASSET: 'ERR_MISSING_ASSET',
  ERR_MISSING_QUERY: 'ERR_MISSING_QUERY',
  ERR_NOT_FEDERATED: 'ERR_NOT_FEDERATED',
  ERR_NOT_FOUND: 'ERR_NOT_FOUND',
  ERR_LOOKUP_FAILED: 'ERR_LOOKUP_FAILED',
  ERR_INSUFFICIENT_FUNDS: 'ERR_INSUFFICIENT_FUNDS',
  ERR_NETWORK_TIMEOUT: 'ERR_NETWORK_TIMEOUT',
  ERR_SLIPPAGE_EXCEEDED: 'ERR_SLIPPAGE_EXCEEDED',
  ERR_NO_PATH_FOUND: 'ERR_NO_PATH_FOUND',
  ERR_STALE_QUOTE: 'ERR_STALE_QUOTE',
  ERR_NETWORK_FAILURE: 'ERR_NETWORK_FAILURE',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// ── Off-Ramp Validation Types (Issue #21) ────────────────────────────────────

export type WithdrawalErrorCode =
  | "INVALID_AMOUNT"
  | "NO_PAYMENT_METHOD"
  | "INSUFFICIENT_BALANCE"
  | "BELOW_MIN_LIMIT"
  | "ABOVE_MAX_LIMIT"
  | "METHOD_DISABLED"
  | "METHOD_NOT_FOUND"
  | "UNKNOWN_ASSET";

/** Result of validating a withdrawal request. */
export interface WithdrawalValidationResult {
  valid: boolean;
  errorCode?: WithdrawalErrorCode;
  errorMessage?: string;
}

/** Full breakdown of a payout calculation. */
export interface PayoutBreakdown {
  cryptoAmount: number;
  asset: string;
  usdValue: number;
  feeAmount: number;
  fixedFee: number;
  percentFee: number;
  netPayout: number;
  paymentMethodId: string;
}

/** UI-level payment method (as used in the off-ramp page). */
export interface UIPaymentMethod {
  id: string;
  type: "bank" | "card";
  name: string;
  details: string;
  fees: string;
  processingTime: string;
  limits: { min: number; max: number };
  enabled: boolean;
}

/** State persisted to localStorage for the last withdrawal. */
export interface PersistedWithdrawal {
  methodId: string;
  methodName: string;
  asset: string;
  amount: number;
  fiatAmount: number;
  status: "completed" | "pending" | "failed";
  hash?: string;
  date: string;
}

// ── Container Interface ──────────────────────────────────────────────────────

/** Selects which implementation to use for a given service. */
export type ServiceMode = 'mock' | 'live'

/** Per-service override map. Omitted keys fall back to `environment`. */
export interface ServiceConfig {
  wallet?: ServiceMode
  offRamp?: ServiceMode
  pricing?: ServiceMode
  fiat?: ServiceMode
  soroban?: ServiceMode
  asset?: ServiceMode
  stellar?: ServiceMode
  pathPayment?: ServiceMode
}

/** Top-level configuration for the service container. */
export interface ContainerConfig {
  /** Shortcut that applies to every service not listed in `services`. */
  environment?: ServiceMode
  /** Per-service overrides. */
  services?: ServiceConfig
}

// ── Issue #19: Enhanced Enterprise Types ──────────────────────────────────────

/** Configuration for the analytics POST on merge events. */
export interface MergeAnalyticsConfig {
  url: string;
  enabled: boolean;
}

/** Settings for test environment isolation. */
export interface TestEnvironmentConfig {
  mockApiDelay: number;
  simulateErrors: boolean;
  errorRate: number;
}

/** Represents a CI workflow step result. */
export interface CIWorkflowStep {
  name: string;
  status: "success" | "failure" | "skipped";
  durationMs: number;
  output?: string;
}

/** Merge analytics payload for CI/CD pipeline tracking. */
export interface MergeAnalyticsPayloadV2 {
  event: "merge";
  repository: string;
  branch: string;
  commit: string;
  timestamp: string;
  author: string;
  issue: number;
  issues: number[];
  status: "success" | "failure";
  coverage_verified: boolean;
  fixture_coverage_verified: boolean;
  accessibility_verified: boolean;
  test_count: number;
  pass_count: number;
  fail_count: number;
}

/** API health check response type. */
export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  uptime: number;
  services: Record<string, "up" | "down">;
}

/** Generic paginated API response wrapper. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
export interface IFinanceServiceContainer {
  wallet: IWalletService;
  pricing: IPricingService;
  offRamp: IOffRampService;
  fiat: IFiatService;
  soroban: ISorobanService;

  // Legacy compatibility
  asset: IAssetService;
  stellar: IStellarService;
  pathPayment: IPathPaymentService;
}

// ── Accessibility Audit (Issue #24) ─────────────────────────────────────────

export type A11yImpactLevel = "critical" | "serious" | "moderate" | "minor" | "unknown";

export type A11yWcagStandard = "WCAG2A" | "WCAG2AA" | "WCAG2AAA";

export interface A11yPageConfig {
  path: string;
  label: string;
  critical: boolean;
}

export interface A11yViolationNode {
  html: string;
  target: string;
}

export interface A11yViolation {
  id: string;
  impact: A11yImpactLevel;
  description: string;
  help: string;
  helpUrl: string;
  nodes: A11yViolationNode[];
}

export interface A11yAuditSummary {
  pagePath: string;
  violationCount: number;
  byImpact: Record<A11yImpactLevel, number>;
  passed: boolean;
  scannedAt: string;
}

export interface A11yAuditRequest {
  path: string;
  minImpact?: A11yImpactLevel;
}

export interface A11yAuditResponse {
  success: boolean;
  path: string;
  standard: A11yWcagStandard;
  summary: A11yAuditSummary;
  violations: A11yViolation[];
  error?: string;
}

export interface IA11yService {
  getPages(): A11yPageConfig[];
  getStandard(): A11yWcagStandard;
  auditPage(request: A11yAuditRequest): A11yAuditResponse;
}

// ── App Shell & Navigation Types (Issue #16) ─────────────────────────────────

/** A single bottom-nav item descriptor */
export interface NavItem {
  label: string
  href: string
  /** Lucide icon name used for icon lookup */
  iconName: string
  /** Match only the exact path (default true) */
  exact?: boolean
}

/** Full shell layout configuration */
export interface AppShellConfig {
  navItems: NavItem[]
  mainContentId: string
  skipLinkLabel: string
  /** Whether to apply env(safe-area-inset-*) padding */
  safeAreaEnabled: boolean
}

/** CSS env() values for each safe-area side */
export interface SafeAreaInsets {
  top: string
  bottom: string
  left: string
  right: string
}

/** API response from GET /api/shell */
export interface ShellConfigResponse {
  success: boolean
  config?: AppShellConfig
  error?: string
}

export interface IShellService {
  getConfig(): AppShellConfig
  getNavItems(): NavItem[]
  getMainContentId(): string
  getSafeAreaInsets(): SafeAreaInsets
}
// ── Chart Types (Issue #17) ──────────────────────────────────────────────────

/** A single data point in the weekly activity bar chart. */
export interface ChartDailyDataPoint {
  /** Short day label, e.g. "M", "T", "W" */
  day: string;
  /** Activity percentage value 0–100 */
  value: number;
  /** Full day name shown in tooltip, e.g. "Monday" */
  label: string;
}

/** A typed Recharts payload entry for bar chart tooltips. */
export interface ChartTooltipEntry {
  value: number;
  dataKey: string;
  name: string;
  /** The underlying row object from `chartData` */
  payload: ChartDailyDataPoint;
  fill?: string;
  color?: string;
  unit?: string;
}

/** Props received by a custom Recharts tooltip content component. */
export interface ActivityTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
}

/** Generic analytics chart data point. */
export interface ChartAnalyticsEntry {
  category: string;
  value: number;
  secondaryValue?: number;
  meta?: Record<string, string | number>;
}

/** Configuration for a single chart series (bar, line, area). */
export interface ChartSeriesConfig {
  dataKey: string;
  label: string;
  color: string;
  gradientId?: string;
}

/** Response from GET /api/analytics */
export interface ChartAnalyticsApiResponse {
  success: boolean;
  data?: {
    period: "week" | "month" | "year";
    points: ChartDailyDataPoint[];
    average: number;
    peak: number;
  };
  error?: string;
}
// ── Transaction History API Types (Issue #13) ────────────────────────────────

export interface TransactionsResponse {
  success: boolean;
  data?: Transaction[];
  error?: string;
}

export type TransactionSortField = 'date' | 'amount' | 'asset';
export type TransactionSortOrder = 'asc' | 'desc';

export interface TransactionFilters {
  type?: TransactionDirection;
  category?: TransactionCategory;
  asset?: AssetCode;
  status?: Transaction['status'];
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: TransactionSortField;
  sortOrder?: TransactionSortOrder;
}

export interface TransactionPage {
  data: Transaction[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface TransactionPageResponse {
  success: boolean;
  data?: TransactionPage;
  error?: string;
}

export interface AddTransactionRequest {
  type: Transaction['type'];
  amount: number;
  asset: AssetCode;
  address: string;
  category?: TransactionCategory;
  name?: string;
  detail?: string;
  currency?: CurrencyCode;
  stellarHash?: string;
}

export interface TransactionSyncStatus {
  lastSyncAt: string | null;
  isSyncing: boolean;
  totalSynced: number;
  pendingCount: number;
}

export interface TransactionSyncResult {
  added: number;
  updated: number;
  failed: number;
  lastSyncAt: string;
}

export interface ITransactionSyncService {
  syncFromNetwork(accountId?: string): Promise<TransactionSyncResult>;
  getLastSyncTime(): string | null;
  getSyncStatus(): TransactionSyncStatus;
  getRecentTransactions(limit: number): Promise<Transaction[]>;
  addTransaction(req: AddTransactionRequest): Promise<Transaction>;
}
