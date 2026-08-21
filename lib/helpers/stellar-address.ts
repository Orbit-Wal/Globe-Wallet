import { StrKey } from '@stellar/stellar-sdk'

/**
 * Canonical Stellar public-key (G...) validation.
 *
 * Issue #71: stellar.service.ts and wallet.service.ts each hand-rolled a
 * regex for this. stellar.service.ts's `[A-Z2-7]{55}` alphabet was close
 * but still accepted strings that fail the StrKey version-byte/CRC16
 * checksum (e.g. any 56-char string with the right alphabet but a mangled
 * checksum). wallet.service.ts's `[A-Z0-9]{55}` with the `i` flag was
 * actively wrong: it accepted `0`, `1`, `8`, `9` (not in base32) and
 * lowercase letters, neither of which appear in a real Stellar address.
 *
 * `StrKey.isValidEd25519PublicKey` (from @stellar/stellar-sdk, already a
 * dependency) does the real decode + checksum verification, so a
 * corrupted address is rejected instead of silently accepted.
 */
export function isValidStellarPublicKey(address: unknown): address is string {
  if (typeof address !== 'string' || address.length === 0) return false
  return StrKey.isValidEd25519PublicKey(address)
}
