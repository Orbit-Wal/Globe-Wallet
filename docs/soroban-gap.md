# Soroban Integration Gap Analysis

## What this PR covers

- `globe-wallet` contract interface synchronization:
  - Hand-maintained spec in `contracts/soroban-spec.json`
  - `ISorobanService` interface in `lib/types.ts` aligned with real contract methods
  - Mock implementation in `lib/services/soroban.service.mock.ts`
  - Live implementation skeleton in `lib/services/soroban.service.ts`
  - CI drift detection via `scripts/check-soroban-sync.mjs`
  - Environment variables for Soroban RPC and contract IDs

## What is blocked upstream

### TokenWrapper contract — no implementation

The `token-wrapper` contract at `Orbit-Wal/contract/contracts/token-wrapper/src/lib.rs`
does not contain a `TokenWrapper` contract implementation. The file currently contains:

- A copy of the GlobeWallet contract code (disambiguated version)
- Test stubs that reference `TokenWrapperClient`, `approve()`, `allowance()`,
  `transfer_from()` — but none of these are defined

The contract's README documents three functions (`approve`, `allowance`,
`transfer_from`) with an `Allowance` struct, but the implementation is missing.

**Impact:** The spec marks `token-wrapper` as `BLOCKED` with a clear reason.
CI skips token-wrapper validation. The `SOROBAN_CONTRACT_ID_TOKEN_WRAPPER`
env var is declared but unused until the implementation is available.

### What will change when token-wrapper is implemented

1. `contracts/soroban-spec.json` will be updated with the real `token-wrapper` methods
2. `ISorobanService` will gain `approve`, `allowance`, and `transferFrom` methods
3. `soroban.service.ts` will implement the token wrapper methods
4. `check-soroban-sync.mjs` will validate token-wrapper in addition to globe-wallet

## Migration path to generated bindings

Once the contract repository produces compilable WASM artifacts:

1. Run `stellar contract bindings ts --wasm path/to/globe_wallet.wasm --output contracts/globe-wallet/bindings.ts`
2. Replace the hand-maintained spec with the generated output
3. Update `check-soroban-sync.mjs` to validate generated bindings instead of JSON spec
4. The `ISorobanService` interface can optionally be replaced by the generated types

The current hand-maintained approach is explicitly accepted by Issue #100's
Definition of Done ("generated or hand-maintained contract spec/bindings").

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SOROBAN_RPC_URL` | Live only | Soroban RPC server URL |
| `SOROBAN_CONTRACT_ID_GLOBE_WALLET` | Live only | Deployed GlobeWallet contract ID |
| `SOROBAN_CONTRACT_ID_TOKEN_WRAPPER` | Pending | Deployed TokenWrapper contract ID (not yet available) |

All three are optional for mock mode. The `SorobanService` throws a clear
configuration error if live mode is selected without these values.
