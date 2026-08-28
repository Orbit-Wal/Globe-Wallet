import type { LedgerDeviceInfo } from '../types'

/**
 * lib/ledger/ledger.service.ts — Issue #92
 *
 * Client-only wrapper around @ledgerhq/hw-transport-webhid +
 * @ledgerhq/hw-app-str (Ledger's Stellar app). This is the hardware-wallet
 * counterpart to lib/services/stellar-payment.service.ts's software-key
 * signing: instead of a server holding STELLAR_SOURCE_SECRET_KEY, the user's
 * physical Ledger device holds the key and signs locally in the browser via
 * WebHID. Nothing here ever sees a private key — only a signature comes
 * back from the device.
 *
 * Must only run in the browser (WebHID is a browser API). The heavy
 * `@ledgerhq/hw-transport-webhid` / `@ledgerhq/hw-app-str` packages are
 * dynamically imported inside connect() so this module is safe to import
 * from server code without pulling in browser-only globals.
 *
 * Solana/Sui signing via their respective Ledger apps
 * (@ledgerhq/hw-app-solana, @ledgerhq/hw-app-sui or equivalent) is a TODO —
 * out of scope for this pass, which focuses on Stellar (the app's primary
 * chain) per Issue #92's own scoping note.
 */

/** Standard Stellar (SLIP-0044 coin type 148) BIP-32 derivation path. */
export const DEFAULT_STELLAR_LEDGER_PATH = "44'/148'/0'"

export class LedgerNotSupportedError extends Error {
  constructor() {
    super('WebHID is not available in this browser. Ledger signing requires Chrome, Edge, or another WebHID-capable browser.')
    this.name = 'LedgerNotSupportedError'
  }
}

export class LedgerNotConnectedError extends Error {
  constructor() {
    super('No Ledger device connected. Call connect() first.')
    this.name = 'LedgerNotConnectedError'
  }
}

// Structural type for the pieces of the @ledgerhq/hw-app-str `Str` class we
// use, so this module doesn't need a static import of the (large, browser-
// dependent) library at the type level.
interface StellarLedgerApp {
  getPublicKey(path: string, display?: boolean): Promise<{ rawPublicKey: Buffer }>
  signTransaction(path: string, signatureBase: Buffer): Promise<{ signature: Buffer }>
}

interface LedgerTransport {
  close(): Promise<void>
}

export class LedgerService {
  private transport: LedgerTransport | null = null
  private stellarApp: StellarLedgerApp | null = null
  private cachedPublicKey: string | null = null

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'hid' in navigator
  }

  get connected(): boolean {
    return this.transport !== null
  }

  /** Opens a WebHID connection to a Ledger device and loads the Stellar app wrapper. */
  async connect(): Promise<void> {
    if (!this.isSupported()) {
      throw new LedgerNotSupportedError()
    }

    const [{ default: TransportWebHID }, { default: Str }] = await Promise.all([
      import('@ledgerhq/hw-transport-webhid'),
      import('@ledgerhq/hw-app-str'),
    ])

    this.transport = (await TransportWebHID.create()) as unknown as LedgerTransport
    this.stellarApp = new Str(this.transport as any) as unknown as StellarLedgerApp
  }

  async disconnect(): Promise<void> {
    await this.transport?.close()
    this.transport = null
    this.stellarApp = null
    this.cachedPublicKey = null
  }

  /**
   * Reads the Stellar public key from the device (does not sign anything).
   * `display: true` makes the device prompt the user to confirm the address
   * on-screen — used the first time a session connects to guard against a
   * compromised host silently reading the wrong account.
   */
  async getPublicKey(path = DEFAULT_STELLAR_LEDGER_PATH, display = false): Promise<string> {
    if (!this.stellarApp) throw new LedgerNotConnectedError()

    const { StrKey } = await import('@stellar/stellar-sdk')
    const { rawPublicKey } = await this.stellarApp.getPublicKey(path, display)
    const publicKey = StrKey.encodeEd25519PublicKey(rawPublicKey)
    this.cachedPublicKey = publicKey
    return publicKey
  }

  /**
   * Signs a Stellar transaction's signature base (StellarSdk.Transaction#signatureBase())
   * on-device. The user must physically approve the transaction on the
   * Ledger's screen — this call blocks until they do (or reject/timeout).
   * Returns the raw 64-byte ed25519 signature, suitable for
   * Transaction#addSignature(publicKey, signature.toString('base64')).
   */
  async signTransaction(signatureBase: Buffer, path = DEFAULT_STELLAR_LEDGER_PATH): Promise<Buffer> {
    if (!this.stellarApp) throw new LedgerNotConnectedError()
    const { signature } = await this.stellarApp.signTransaction(path, signatureBase)
    return signature
  }

  getDeviceInfo(path = DEFAULT_STELLAR_LEDGER_PATH): LedgerDeviceInfo {
    return {
      connected: this.connected,
      publicKey: this.cachedPublicKey ?? undefined,
      path,
    }
  }
}

// Single shared instance — a Ledger device is a physical, singular resource
// per browser tab, same reasoning as the RPC client singletons in the other
// chain services.
export const ledgerService = new LedgerService()
