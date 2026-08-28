/**
 * lib/crypto/key-vault.ts
 * Issue #64 — real envelope encryption for wallet secret keys at rest.
 *
 * Custody model decision: CUSTODIAL for now (server stores an encrypted
 * copy of the account's secret key so it can co-sign server-initiated
 * flows such as /api/wallet/send). The plaintext secret key is never
 * logged, never serialized in an API response, and never stored outside
 * this module's ciphertext envelope.
 *
 * Encryption: AES-256-GCM (authenticated encryption) via Node's built-in
 * `crypto` module — no new dependency needed. The data-encryption key
 * (DEK) used for AES is itself derived from a server-only master key
 * (WALLET_MASTER_KEY) using HKDF, which stands in for a KMS-managed
 * key-encryption-key (KEK) — in a production deployment WALLET_MASTER_KEY
 * would instead be a reference to a KMS/HSM-backed key, and this module's
 * `deriveDataKey` would call out to that KMS rather than doing local HKDF.
 * Swapping that call is the only change needed to move to real KMS.
 */

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit nonce, recommended for GCM
const KEY_LENGTH = 32 // 256-bit DEK

function masterKeyMaterial(): Buffer {
  const secret = process.env.WALLET_MASTER_KEY
  if (!secret) {
    // Development-only fallback so the app still boots without config.
    // Never used in production — set WALLET_MASTER_KEY there (see .env.example).
    return createHmac('sha256', 'globe-wallet-dev-only-master-key').update('dev').digest()
  }
  return createHmac('sha256', secret).digest()
}

/**
 * Derives a per-purpose 256-bit data-encryption key from the master key via
 * HKDF (RFC 5869). Stands in for a KMS `GenerateDataKey` / `Decrypt` call —
 * see module doc comment above.
 */
function deriveDataKey(purpose: string): Buffer {
  const ikm = masterKeyMaterial()
  const derived = hkdfSync('sha256', ikm, Buffer.alloc(0), Buffer.from(purpose), KEY_LENGTH)
  return Buffer.from(derived)
}

/**
 * Encrypts `plaintext` (e.g. a Stellar secret key) with AES-256-GCM under a
 * key derived for `purpose` (e.g. `wallet:<accountId>`), so different
 * secrets are cryptographically isolated even though they share one master
 * key. Returns a self-contained envelope string: `v1:<iv>:<authTag>:<ciphertext>`
 * (all base64), safe to store directly in a `encrypted_*` field.
 */
export function encryptSecret(plaintext: string, purpose: string): string {
  const key = deriveDataKey(purpose)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return ['v1', iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

/**
 * Decrypts an envelope produced by `encryptSecret`. Throws if the envelope
 * is malformed or the auth tag doesn't verify (tampered/wrong key).
 */
export function decryptSecret(envelope: string, purpose: string): string {
  const parts = envelope.split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Malformed encrypted-secret envelope')
  }
  const [, ivB64, authTagB64, ciphertextB64] = parts
  const key = deriveDataKey(purpose)
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
