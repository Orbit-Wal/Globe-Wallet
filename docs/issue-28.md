# Issue #28 — Environment Setup & Stellar Network Configuration Notes

## Overview

This document covers everything a developer needs to configure their local environment and understand how Globe Wallet connects to the Stellar network. It is the canonical reference for environment variables, testnet vs mainnet selection, and key security rules.

Cross-references:
- [Architecture overview](./architecture.md)
- [Developer onboarding (Issue #29)](./issue-29.md)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Environment Variables Reference](#3-environment-variables-reference)
4. [Stellar Network Configuration](#4-stellar-network-configuration)
5. [Running the App Locally](#5-running-the-app-locally)
6. [CI Environment](#6-ci-environment)
7. [Security & Key Handling](#7-security--key-handling)
8. [Troubleshooting](#8-troubleshooting)
9. [Rollout & Migration Notes](#9-rollout--migration-notes)

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | Use [nvm](https://github.com/nvm-sh/nvm) to manage versions |
| pnpm | 8+ | `npm install -g pnpm` |
| Git | any | — |
| A Stellar testnet account | — | Generate at [Stellar Laboratory](https://laboratory.stellar.org/#account-creator) |

You do **not** need a real Stellar account or any real funds to run the app locally. The default configuration connects to Stellar's free public testnet.

---

## 2. Installation

```bash
git clone https://github.com/Orbit-Wal/Globe-Wallet.git
cd Globe-Wallet
pnpm install
```

Then create a `.env.local` file in the repo root (see the template in [Section 3](#3-environment-variables-reference)). This file is already in `.gitignore` — never commit it.

---

## 3. Environment Variables Reference

### `.env.local` template

Copy this into `.env.local` at the repo root and fill in the values for your setup.

```env
# ── Stellar Network ──────────────────────────────────────────────────────────

# Which Stellar network to connect to.
# Use 'testnet' for local development. Only set to 'mainnet' in production deployments.
NEXT_PUBLIC_STELLAR_NETWORK=testnet

# Stellar Horizon API base URL.
# Testnet:  https://horizon-testnet.stellar.org
# Mainnet:  https://horizon.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# ── App Environment ──────────────────────────────────────────────────────────

# Controls UI hints and environment-specific behaviour.
# Valid values: development | staging | production
NEXT_PUBLIC_APP_ENV=development
```

### Full variable reference

| Variable | Required | Visibility | Description |
|---|---|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | Yes | Client + Server | `testnet` or `mainnet`. Controls which Horizon URL and passphrase are used. Defaults to `testnet` if unset. |
| `STELLAR_HORIZON_URL` | Yes | Server only | Horizon REST API base URL. Must match the network above. |
| `NEXT_PUBLIC_APP_ENV` | No | Client + Server | `development`, `staging`, or `production`. Used for UI hints (e.g. testnet badge). Defaults to `development`. |
| `STELLAR_NETWORK_PASSPHRASE` | No | Server only | Override the network passphrase. Only needed for custom/private Stellar networks. If unset, the correct passphrase is derived from `NEXT_PUBLIC_STELLAR_NETWORK`. |
| `STELLAR_SOURCE_SECRET_KEY` | No | Server only | Secret key of the account that signs/submits real payments in `/api/wallet/send` (Issue #63). Leave unset in any environment without a funded signing account — the route responds with `ERR_PAYMENT_NOT_CONFIGURED` instead of a fabricated result. See [Section 7](#7-security--key-handling) below before setting this to anything but a testnet key. |
| `MERGE_ANALYTICS_URL` | CI only | Server only | Endpoint that receives a POST on every merge to `main`. Stored as a GitHub Actions secret — never in `.env` files. |

> Variables prefixed with `NEXT_PUBLIC_` are embedded in the client bundle at build time. Do not put secrets in them.

### Service mode resolution

`NEXT_PUBLIC_APP_ENV` also selects mock vs live service implementations inside `FinanceServiceContainer`:

| Value  | Service mode | Behaviour                          |
|--------|-------------|-------------------------------------|
| unset / `development` / `staging` | `mock` | Returns in-memory mock data; no network calls, no Stellar endpoints. |
| `production`                      | `live` | Uses live Stellar Horizon / Soroban endpoints. **Currently falls back to mock** — add real implementations in `SERVICE_FACTORIES` in `container.ts` per-service. |

Override per service by passing a `ContainerConfig` to the constructor — see `lib/types.ts` for the full shape.

---

## 4. Stellar Network Configuration

### Testnet vs Mainnet

| | Testnet | Mainnet |
|---|---|---|
| Horizon URL | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |
| Network passphrase | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| Funded accounts | Via [Stellar Friendbot](https://friendbot.stellar.org) | Requires real XLM |
| Real value | No | Yes |
| Use for | Local dev, CI, staging | Production only |

### How the app selects the network

The `NEXT_PUBLIC_STELLAR_NETWORK` variable is the single switch:

- Set to `testnet` (or leave unset) → connects to Horizon testnet, uses testnet passphrase.
- Set to `mainnet` → connects to Horizon mainnet, uses mainnet passphrase.

Any unrecognised value falls back to `testnet` — the app never silently connects to mainnet.

### Funding a testnet account

Testnet accounts start with zero balance. Use Stellar Friendbot to fund one instantly:

```bash
curl "https://friendbot.stellar.org?addr=<YOUR_TESTNET_PUBLIC_KEY>"
```

Or use the [Stellar Laboratory account creator](https://laboratory.stellar.org/#account-creator) which funds automatically.

### Network passphrase

The network passphrase is used when **signing transactions** on the Stellar SDK. If you are building custom transaction logic, always derive it from `NEXT_PUBLIC_STELLAR_NETWORK` — never hardcode the string. The current service layer reads it via the container configuration.

### Checking the active network

The app exposes the current network via `GET /api/stellar`, which returns the `StellarAccount` shape including the `network` field. During development you can inspect it:

```bash
curl http://localhost:3000/api/stellar
```

```json
{
  "success": true,
  "data": {
    "account": {
      "publicKey": "GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX",
      "name": "Primary Wallet",
      "network": "Stellar Public Network",
      "isFunded": true
    }
  }
}
```

---

## 5. Running the App Locally

```bash
# Start the development server
pnpm dev
# → http://localhost:3000

# Type-check and build (no TS errors = ready for PR)
pnpm build

# Lint
pnpm lint

# Run unit + component + integration tests
npm test

# Run E2E tests (Playwright starts the dev server automatically)
npm run test:e2e
```

### Switching networks locally

To test against mainnet (read-only, no real funds needed):

```env
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org
```

Restart the dev server after changing `.env.local`.

> Do not send real transactions during development. Use testnet accounts for all testing.

---

## 6. CI Environment

The CI pipeline (`.github/workflows/ci.yml`) runs on GitHub Actions with Node 20. It does **not** use a `.env.local` file — environment variables are injected via repository secrets and the workflow `env:` block.

### Secrets required in GitHub Actions

Navigate to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Description |
|---|---|
| `MERGE_ANALYTICS_URL` | Webhook endpoint that receives merge event payloads |

The Stellar variables (`NEXT_PUBLIC_STELLAR_NETWORK`, `STELLAR_HORIZON_URL`) can be set as repository variables (not secrets, since they are not sensitive for testnet) or left at their defaults — the app uses testnet by default.

### What the CI pipeline does

1. Installs dependencies with `npm ci`
2. Runs unit, component, and integration tests (`jest`)
3. Installs Playwright browsers
4. Runs E2E tests
5. On merge to `main`: POSTs a JSON analytics event to `MERGE_ANALYTICS_URL`

The analytics payload includes the repository, commit SHA, author, timestamp, and issue reference so merge activity is tracked centrally.

---

## 7. Security & Key Handling

### The golden rules

1. **Never commit `.env.local`** — it is in `.gitignore` for this reason.
2. **Never put a Stellar secret key (starts with `S`) anywhere in the codebase**, tests, or docs. Secret keys have real value on mainnet and should only ever exist in a hardware wallet, secure enclave, or password manager. The one runtime exception is `STELLAR_SOURCE_SECRET_KEY` (Issue #63), which is deliberately an environment variable so `/api/wallet/send` can sign real testnet payments during development — see the mainnet checklist below before this app ever handles a mainnet key this way.
3. **Never put `MERGE_ANALYTICS_URL` in `.env` files** — it is a CI secret only.
4. **Never prefix secrets with `NEXT_PUBLIC_`** — those variables are embedded in the client bundle and visible to everyone.

### Testnet keypairs for development

Generate a throwaway keypair for local testing:

- [Stellar Laboratory](https://laboratory.stellar.org/#account-creator) — generates and funds a testnet keypair in one click.
- The public key (starts with `G`) is safe to share and commit in test fixtures.
- The secret key (starts with `S`) **must never appear in code or docs**.

### Mainnet deployment checklist

Before switching `NEXT_PUBLIC_STELLAR_NETWORK=mainnet` in any environment:

- [ ] Confirm the deployment is production-grade (not a developer laptop).
- [ ] Private key management uses a hardware wallet or HSM — not environment variables.
- [ ] `STELLAR_SOURCE_SECRET_KEY` is **unset** in this deployment's environment. A single env-var signing key is a testnet/development convenience (Issue #63) — real per-account custody (HSM/vault-backed, keyed off each wallet account's `encrypted_private_key` reference in `lib/db/mock-db.ts`) must replace it before this app ever moves real funds. Tracked as follow-up work in [docs/issue-63.md](./issue-63.md).
- [ ] Rate limiting is enabled at the infrastructure layer.
- [ ] `STELLAR_HORIZON_URL` points to `https://horizon.stellar.org` (not testnet).
- [ ] KYC/AML requirements for your jurisdiction have been reviewed.

---

## 8. Troubleshooting

### `Error: NEXT_PUBLIC_STELLAR_NETWORK is not set`

The app defaults to testnet. If you see this warning in logs, add the variable to `.env.local`:

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

### `Horizon request failed: 404`

Your `STELLAR_HORIZON_URL` is pointing to the wrong network. Check that the URL matches the network:

- Testnet → `https://horizon-testnet.stellar.org`
- Mainnet → `https://horizon.stellar.org`

### `Transaction failed: invalid network passphrase`

The passphrase used when signing the transaction does not match the network. Ensure you are using the correct passphrase for `NEXT_PUBLIC_STELLAR_NETWORK`. Do not hardcode it — derive it from the environment.

### `Address validation failed for a known-good address`

The `validateAddress` regex in `StellarService` uses `/^G[A-Z2-7]{55}$/` (strict base-32). Some Stellar addresses use digits `0-9`. The `WalletService` uses the broader `/^G[A-Z0-9]{55}$/i` pattern. Make sure you are calling the right service method for your use case.

### Tests fail with `Cannot find module '@/lib/helpers/...'`

Confirm `tsconfig.json` has `"@/*": ["./*"]` in `paths` and that `jest.config.js` passes through the Next.js Jest transformer (`nextJest({ dir: './' })`).

---

## 9. Rollout & Migration Notes

This document is purely additive — no runtime code changes were made for issue #28. The changes are:

- `docs/issue-28.md` — this file
- `README.md` — cross-link added to the Documentation section

If your team previously had Stellar configuration spread across individual developer READMEs or Notion pages, this document supersedes those. Direct contributors here for the canonical reference.
