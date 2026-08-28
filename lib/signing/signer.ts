import type { SigningMethod } from '../types'

/**
 * lib/signing/signer.ts — Issue #92
 *
 * Signing abstraction so transaction-*building* code doesn't need to know
 * whether the signature comes from the server's configured software key
 * (STELLAR_SOURCE_SECRET_KEY, via StellarPaymentService — the existing
 * "local-key" path, unchanged by this file) or an external hardware signer.
 *
 * The "local-key" method needs no ISigner implementation here: it's the
 * existing server-only flow in lib/services/stellar-payment.service.ts
 * (StellarPaymentService#submitPayment), which builds, signs, and submits
 * in one call because the key lives on the server.
 *
 * The "ledger" method is different in kind, not just in key source: signing
 * must happen in the user's browser, with the device physically present.
 * That's why StellarPaymentService also exposes buildUnsignedTransaction()
 * and submitSignedTransaction() — the split lets an ISigner (like
 * LedgerSigner below) sign in between those two server calls without the
 * transaction-building logic itself changing at all.
 *
 * Flow for an external signer:
 *   1. POST /api/wallet/send/prepare  -> { xdr, signatureBase, networkPassphrase }
 *   2. signer.sign(Buffer.from(signatureBase, 'base64'))  -> raw signature
 *   3. POST /api/wallet/send/submit-signed  -> TransactionResult
 */

export interface ISigner {
  readonly method: SigningMethod
  /** Stellar public key (G...) this signer will sign with. */
  getPublicKey(): Promise<string>
  /** Signs a transaction's signature base, returning the raw 64-byte ed25519 signature. */
  sign(signatureBase: Buffer): Promise<Buffer>
}

/**
 * Ledger hardware-wallet signer. Thin adapter over LedgerService so callers
 * that only care about the ISigner contract (e.g. a generic "sign with
 * whatever's selected" send flow) don't need to know about WebHID/hw-app-str
 * directly.
 */
export class LedgerSigner implements ISigner {
  readonly method: SigningMethod = 'ledger'

  constructor(
    private readonly path?: string,
  ) {}

  async getPublicKey(): Promise<string> {
    const { ledgerService, DEFAULT_STELLAR_LEDGER_PATH } = await import('../ledger/ledger.service')
    if (!ledgerService.connected) {
      await ledgerService.connect()
    }
    return ledgerService.getPublicKey(this.path ?? DEFAULT_STELLAR_LEDGER_PATH)
  }

  async sign(signatureBase: Buffer): Promise<Buffer> {
    const { ledgerService, DEFAULT_STELLAR_LEDGER_PATH } = await import('../ledger/ledger.service')
    if (!ledgerService.connected) {
      await ledgerService.connect()
    }
    return ledgerService.signTransaction(signatureBase, this.path ?? DEFAULT_STELLAR_LEDGER_PATH)
  }
}
