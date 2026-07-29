# Issue #63 — Real Stellar Submission for `sendPayment` / `/api/wallet/send`

## Root cause

`app/api/wallet/send/route.ts` validated the request shape (address regex,
positive amount, asset present) and then returned a **fabricated** result:

```ts
const hash = `0x${Math.random().toString(16).slice(2, 66)}`
const result: TransactionResult = { success: true, hash, status: 'completed' }
```

No Stellar transaction was ever built, signed, or submitted. `0x`-prefixed
hex is not a Stellar transaction hash format at all (real hashes are 64
lowercase hex characters, no `0x` prefix) — so even the shape of the "proof"
was wrong, not just its provenance. `lib/services/wallet.service.ts::sendPayment`
compounded this: it persisted every attempt as `status: 'completed'`
**regardless of what the route actually returned**, so even fixing the route
alone would not have fixed the local transaction history.

Meanwhile `lib/services/transaction-sync.service.ts` already does real,
read-only Horizon polling (merged for a related issue), and
`Orbit-Wal/backend`'s `StellarService.sendPayment` already builds, signs, and
submits real payments using `@stellar/stellar-sdk` — proving both that the
SDK is already a proven, working dependency in this ecosystem and that a
real implementation was never actually blocked on tooling.

## Design decision: embedded Horizon SDK, not a call to `Orbit-Wal/backend`

The Definition of Done allows either "a backend API call or direct Horizon
SDK." I chose **direct SDK usage inside this app's own route handler**:

- `Orbit-Wal/backend`'s `POST /api/v1/wallet/send` takes a raw
  `sourceSecretKey` in the request body. Globe Wallet has no secret-key
  storage anywhere in its account model (`WalletAccountSchema` in
  `lib/db/mock-db.ts` only has a placeholder `encrypted_private_key: 'vault...key'`
  string) — proxying to the backend would not remove the need to have a
  signing key available to this app, it would just add a second network hop
  and a second deployable service to configure/authenticate against for no
  reduction in the actual hard part (key custody).
- `@stellar/stellar-sdk` is already a direct dependency here, already used
  server-side in `transaction-sync.service.ts` and `soroban.service.ts`, and
  `next.config.mjs` already `transpilePackages`s it. Building on that
  existing, working integration is strictly less new surface area than
  standing up cross-service auth to a separate Express API.
- It keeps this fix self-contained and testable in this repo without a
  second running service, matching how `transaction-sync.service.ts` was
  implemented for the read side.

## The remaining hard part: signing key custody

Real submission needs a secret key. This app's account model doesn't have
one anywhere — the mock accounts (`TEST_STELLAR_ADDRESS`,
`SECONDARY_STELLAR_ADDRESS` in `lib/fixtures/stellar.ts`) are placeholder
public keys with no corresponding secret, by design (this is a demo/mock
wallet). I did not invent a fake custody layer to paper over that — instead:

- `lib/services/stellar-payment.service.ts` reads a **server-only**
  `STELLAR_SOURCE_SECRET_KEY` env var (new — added to `lib/env.mjs` and
  `.env.example`, optional so a fresh checkout still boots/dev without it).
- If it's unset, the route returns `503 ERR_PAYMENT_NOT_CONFIGURED` instead
  of fabricating anything. Fail loud, never fail silent-successful — see
  `SorobanService.requireConfig()` for the existing precedent of this
  pattern in this codebase.
- If a caller explicitly names a **different** `accountId` than the one the
  configured key controls (multi-account switcher), the route rejects with
  `409 ERR_ACCOUNT_KEY_MISMATCH` rather than silently signing/sending from
  the wrong account. The default/active-account path (what every existing
  caller uses) is unaffected.
- **Follow-up, explicitly out of scope here**: real per-account custody
  (HSM/vault-backed, keyed off each account's `encrypted_private_key`
  reference) so multiple wallet accounts can each sign with their own key.
  A single env-var signing key is a deliberate, minimal, honestly-documented
  stopgap for this issue, not a design the project should keep long-term.

## Definition of done — how each bullet is satisfied

- **"Route delegates to real transaction building/signing/submission ...
  direct Horizon SDK"**: `StellarPaymentService.submitPayment()` builds a
  `TransactionBuilder` payment operation, signs it with the configured
  `Keypair`, and calls `server.submitTransaction()` — the same shape of code
  as `Orbit-Wal/backend`'s `StellarService.sendPayment`.
- **"`status` reflects actual ledger state (`pending`/`completed`/`failed`),
  not an assumed success"**: `submitTransaction()`'s `successful` field
  drives `completed` vs `failed`. A Horizon-returned rejection (a response
  with an HTTP status, e.g. `op_underfunded`) is `failed`, with the
  human-readable `result_codes` in `error`. A response-less network failure
  (timeout, dropped connection — we never got Horizon's answer) is `pending`,
  not `failed`, because the envelope may still land in a ledger — that
  ambiguity is real and shouldn't be reported as a definite outcome either
  way. `TransactionSyncService.syncFromNetwork()` (already merged, read-only
  Horizon polling) reconciles a `pending` hash the next time it runs — this
  wasn't a dead end to design around, it was already-existing machinery this
  fix now actually feeds.
- **"Persisted transaction record stores a real, verifiable Stellar tx hash
  format"**: the hash is `transaction.hash().toString('hex')` — the SDK's
  own signature hash, computed right after signing and **before**
  submission, so it exists and is correct even when submission is rejected
  or times out. `wallet.service.ts::sendPayment` was also fixed to persist
  `result.status` instead of a hardcoded `'completed'` (see "Adjacent
  behavior" below) — the old code would have shown a "completed" transaction
  in history even for a hash the route now correctly reports as `failed`.

## Adjacent behavior re-verified (not assumed unaffected)

- **`wallet.service.ts::sendPayment`'s persistence bug**: independent of the
  route, `db.saveTransaction(...)` always wrote `status: 'completed'`. Fixed
  to use `result.status ?? (result.success ? 'completed' : 'failed')`. Covered
  by two new tests in `tests/unit/services/wallet.service.test.ts` asserting
  the persisted record for a `pending` and a `failed` route response.
- **`useWalletSend` / `SendForm` UI**: `success` now means "not a definitive
  failure" (covers both `completed` and `pending`), so a pending broadcast
  doesn't show as a false "Payment failed" error. The success card
  (`components/app/send-form.tsx`) now distinguishes "Send Complete" from
  "Send Submitted — awaiting network confirmation" using the existing
  `TransactionStatusBadge` component, instead of always saying "Transaction
  Successful" regardless of real status.
- **Destination address validation**: upgraded from a `/^G[A-Z0-9]{55}$/i`
  regex (accepts any 56-char string in the right alphabet, checksum or not)
  to `StrKey.isValidEd25519PublicKey` — the real StrKey checksum check. This
  is why several existing tests' placeholder addresses
  (`GDXSPAYWALLET7QK3...`, `GC3G2N7N5LRYX6L5...`) needed replacing with
  actual checksummed keys; they were never valid Stellar public keys, they
  just matched the old regex.
- **Asset and memo validation**: the route previously accepted any string as
  `asset` (would have silently "succeeded" for a typo'd or unsupported
  code) and never checked memo length. Both now validated against
  `SUPPORTED_STELLAR_ASSETS` and Stellar's 28-byte `MEMO_TEXT` limit before
  any network call, with new `ERR_UNSUPPORTED_ASSET` / `ERR_MEMO_TOO_LONG`
  error codes.
- **Drive-by fix (test infra)**: `components/ui/alert.tsx` declared
  `AlertTitle` twice (a verbatim, byte-for-byte duplicate — a copy-paste
  merge artifact). That's a Jest parse error for every test importing
  `Alert` transitively, including `tests/component/send-form.test.tsx`,
  which this PR already extends with a new pending-state test. Removed the
  duplicate so that test (and three other previously-broken suites:
  `CryptoConverter.test.tsx`, `WalletErrorAlert.test.tsx`,
  `send-flow.test.tsx`) actually run and pass instead of being asserted
  only in isolation.
- **Drive-by fix**: `soroban.service.ts` hardcoded the **Futurenet**
  passphrase (`Test SDF Future Network ; October 2022`) for the `testnet`
  branch — a real, separate bug in the same "which network passphrase do we
  sign with" logic this issue touches. Corrected to the actual testnet
  passphrase (`Test SDF Network ; September 2015`) using the SDK's own
  `Networks` constants, which `stellar-payment.service.ts` also uses (rather
  than repeating the same hardcoded-string mistake).

## Test coverage

- `tests/unit/services/stellar-payment.service.test.ts` — fully mocks
  `@stellar/stellar-sdk` to test the status-mapping logic in isolation:
  completed / failed (with real result-code parsing) / pending (response-less
  error) / missing source account / unsupported asset / config-missing.
- `tests/integration/api-wallet.test.ts` and
  `tests/integration/fixture-integration.test.ts` — mock only
  `Horizon.Server`'s network calls (`jest.requireActual` for everything
  else), so these exercise **real** `TransactionBuilder`/`Keypair`/`StrKey`
  code end-to-end against an in-memory account, never touching the network.
- `tests/integration/wallet-send-unconfigured.test.ts` — the
  `ERR_PAYMENT_NOT_CONFIGURED` path, with the env var genuinely unset for
  the whole file.
- `tests/unit/services/wallet.service.test.ts`,
  `tests/unit/hooks/useWalletSend.test.ts`,
  `tests/component/send-form.test.tsx` — updated/extended for the
  status-persistence fix and the pending-vs-completed UI distinction.
- `verify-send.ts` (repo root, mirrors the existing `verify.ts` /
  `test-err.ts` precedent from the Horizon-polling issue) — a manual script
  that runs the real route handler against Stellar **testnet** with a
  funded throwaway keypair. See the PR description for a full run's output,
  independently re-verified against `GET /transactions/:hash` on
  `horizon-testnet.stellar.org` for both the completed and the two failed
  cases.

## New environment variable

See `.env.example` and [docs/issue-28.md](./issue-28.md#3-environment-variables-reference)
for `STELLAR_SOURCE_SECRET_KEY` — optional, server-only, unset by default.
