import { IOffRampService, AssetCode, CurrencyCode, TransactionResult, OffRampMethod, OffRampServiceError } from '../types'
import { BaseService } from './base.service'
import { OFF_RAMP_RATES } from '../fixtures'

/**
 * Level 2 Architecture Sync: Off-Ramp Service
 * Issue #69 — real SEP-24 interactive withdrawal against a configured
 * anchor (SEP24_ANCHOR_URL, see .env.example), replacing the previous
 * setTimeout()+Math.random() simulation. Anchor must implement SEP-24's
 * GET /info, POST /transactions/withdraw/interactive, and GET /transaction.
 */

// Default method → currency configuration, used until an anchor is
// configured or its /info response is fetched. Previously this array was
// the *only* source of truth, hardcoded inline in getMethods(); it is now
// just the fallback seed for `this.methods`, which `refreshFromAnchor()`
// replaces with the anchor's real advertised withdraw currencies.
const DEFAULT_METHODS: OffRampMethod[] = [
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

interface Sep24WithdrawInteractiveResponse {
    type: string
    url: string
    id: string
}

interface Sep24InfoWithdrawEntry {
    enabled?: boolean
    min_amount?: number
    max_amount?: number
}

function getAnchorUrl(): string | null {
    const url = process.env.SEP24_ANCHOR_URL
    return url ? url.replace(/\/$/, '') : null
}

/**
 * Optional bearer token for an already-established SEP-10 web-auth session
 * (SEP24_ANCHOR_JWT). Full SEP-10 challenge/response is out of scope here —
 * tracked as follow-up; most sandbox anchors (e.g. testanchor.stellar.org)
 * accept unauthenticated interactive-withdraw requests for demo purposes.
 */
function getAnchorAuthHeaders(): Record<string, string> {
    const jwt = process.env.SEP24_ANCHOR_JWT
    return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}

export class OffRampService extends BaseService implements IOffRampService {
    private methods: OffRampMethod[] = DEFAULT_METHODS

    constructor() {
        super('OffRampService')
    }

    /**
     * Fetches the anchor's SEP-24 GET /info and rebuilds the method list
     * from its `withdraw` currency map, so method IDs reflect real anchor
     * asset/currency configuration instead of the hardcoded defaults. Safe
     * to call repeatedly (e.g. on a refresh interval); no-ops when no
     * anchor is configured, and leaves `this.methods` unchanged on error.
     */
    async refreshFromAnchor(): Promise<void> {
        const base = getAnchorUrl()
        if (!base) return

        try {
            const res = await fetch(`${base}/info`, { headers: getAnchorAuthHeaders() })
            if (!res.ok) {
                throw new OffRampServiceError(`Anchor /info request failed: HTTP ${res.status}`)
            }
            const info = await res.json()
            const withdraw = info?.withdraw as Record<string, Sep24InfoWithdrawEntry> | undefined
            if (!withdraw) return

            const nextMethods: OffRampMethod[] = Object.entries(withdraw)
                .filter(([, cfg]) => cfg?.enabled)
                .map(([assetCode, cfg]) => ({
                    id: `anchor-${assetCode.toLowerCase()}`,
                    name: `${assetCode} Withdrawal`,
                    description: `Withdraw ${assetCode} via the configured SEP-24 anchor`,
                    currency: assetCode as CurrencyCode,
                    minAmount: cfg.min_amount ?? 0,
                    maxAmount: cfg.max_amount ?? Number.MAX_SAFE_INTEGER,
                    processingTime: 'Varies by anchor',
                    fee: 0,
                }))

            if (nextMethods.length > 0) {
                this.methods = nextMethods
            }
        } catch (err) {
            if (process.env.NODE_ENV !== 'test') {
                console.error(`[${this.serviceName}] refreshFromAnchor failed:`, err)
            }
        }
    }

    /**
     * Real SEP-24 interactive withdrawal initiation. Posts to the anchor's
     * /transactions/withdraw/interactive endpoint and returns the anchor's
     * transaction id (as `hash`, kept for TransactionResult compatibility)
     * plus the hosted interactive URL the client must redirect the user to
     * — per spec, the withdrawal isn't actually submitted until the user
     * completes that hosted flow, so `status` is genuinely 'pending' here,
     * not a stand-in.
     *
     * `account` is the withdrawing Stellar public key; required by SEP-24.
     */
    async initiateWithdrawal(
        amount: number,
        asset: AssetCode,
        methodId: string,
        currency: CurrencyCode,
        account?: string,
    ): Promise<TransactionResult> {
        return this.withPerformanceTracking('initiateWithdrawal', async () => {
            try {
                if (amount <= 0) {
                    throw new OffRampServiceError("Amount must be greater than zero")
                }

                const base = getAnchorUrl()
                if (!base) {
                    throw new OffRampServiceError(
                        'SEP-24 anchor is not configured. Set SEP24_ANCHOR_URL as a server-only ' +
                        'environment variable — see .env.example.',
                    )
                }
                if (!account) {
                    throw new OffRampServiceError(
                        'A Stellar account public key is required to initiate a SEP-24 withdrawal.',
                    )
                }

                // SEP-24 §6.1: initiate an interactive withdrawal. The
                // reference anchor implementation accepts url-encoded form
                // fields for this request.
                const form = new URLSearchParams()
                form.set('asset_code', asset)
                form.set('account', account)
                form.set('amount', String(amount))
                form.set('lang', 'en')

                const res = await fetch(`${base}/transactions/withdraw/interactive`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        ...getAnchorAuthHeaders(),
                    },
                    body: form.toString(),
                })

                if (!res.ok) {
                    const detail = await res.text().catch(() => '')
                    throw new OffRampServiceError(
                        `Anchor rejected the withdrawal request (HTTP ${res.status}): ${detail || 'no detail provided'}`,
                    )
                }

                const interactive = (await res.json()) as Sep24WithdrawInteractiveResponse
                if (!interactive?.id || !interactive?.url) {
                    throw new OffRampServiceError('Anchor response is missing required id/url fields')
                }

                return {
                    success: true,
                    hash: interactive.id,
                    status: 'pending',
                    interactiveUrl: interactive.url,
                } as TransactionResult
            } catch (err) {
                this.handleError(err, 'initiateWithdrawal')
            }
        })
    }

    /**
     * Polls the anchor's SEP-24 GET /transaction endpoint for the current
     * status of a previously-initiated withdrawal, so a persisted
     * transaction can transition out of 'pending' (a webhook handler is
     * the push-based alternative; this is the pull-based one — either can
     * call this method with the anchor transaction id returned above).
     */
    async getWithdrawalStatus(anchorTransactionId: string): Promise<{ status: string; amountOut?: string }> {
        const base = getAnchorUrl()
        if (!base) {
            throw new OffRampServiceError(
                'SEP-24 anchor is not configured. Set SEP24_ANCHOR_URL as a server-only ' +
                'environment variable — see .env.example.',
            )
        }

        const res = await fetch(`${base}/transaction?id=${encodeURIComponent(anchorTransactionId)}`, {
            headers: getAnchorAuthHeaders(),
        })
        if (!res.ok) {
            throw new OffRampServiceError(`Anchor transaction status request failed: HTTP ${res.status}`)
        }

        const body = await res.json()
        return {
            status: body?.transaction?.status ?? 'unknown',
            amountOut: body?.transaction?.amount_out,
        }
    }

    async getRates(): Promise<Record<string, number>> {
        return { ...OFF_RAMP_RATES }
    }

    getMethods(): OffRampMethod[] {
        return this.methods
    }
}
