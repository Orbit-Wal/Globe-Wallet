/**
 * Issue #102 — testnet-backed integration test TEMPLATE.
 *
 * Every mock-to-real migration this repo has planned (Soroban calls,
 * Horizon submission, federation SEP-2, SEP-24 off-ramp) will eventually
 * need a test that hits a real testnet endpoint instead of a mock/fixture.
 * Nothing in the current suite does that yet — it's all deterministic and
 * network-free by design, which is correct for unit/component/most
 * integration tests, but leaves no established pattern for the tests that
 * *do* need to be network-real. This file is that pattern, applied to the
 * smallest real dependency this repo already talks to: Horizon testnet.
 *
 * Why Horizon testnet (and not federation SEP-2, which the issue suggested
 * as "likely smallest")?  Federation lookups target a *third party's*
 * domain (`user*their-domain.tld`) — this repo doesn't operate one, so a
 * federation-SEP-2 template would depend on some external test fixture
 * domain staying up indefinitely, which isn't a dependency this repo
 * controls. Horizon testnet + Friendbot are both operated by SDF
 * specifically for this purpose (throwaway testnet accounts, no
 * provisioning secrets needed) — the same env-gating / retry / no-mocks
 * pattern below applies directly to a federation test once a stable target
 * domain exists; only the "provision a fixture" step changes.
 *
 * Pattern this file demonstrates (see docs/issue-102.md for the CI-level
 * strategy this implements):
 *
 *   1. Opt-in gating: skips (not fails) unless RUN_TESTNET_INTEGRATION=1 is
 *      set, so `npm test` / the default CI `test` job never depends on
 *      outbound network access or testnet uptime. A dedicated CI job (or a
 *      local `npm run test:testnet`) sets the flag explicitly.
 *   2. Fixture provisioning with no stored secrets: a fresh keypair is
 *      generated per test run and funded via Friendbot — no funded account
 *      secret needs to live in CI secrets at all, which sidesteps the
 *      "who tops it back up" problem long-lived funded fixtures have.
 *   3. Retry policy: transient network/testnet flakiness is retried with
 *      backoff (withRetry below) rather than the test flaking CI outright,
 *      but a real assertion failure (wrong data) is never retried away.
 *   4. No mocks anywhere in the network path: real fetch, real Horizon
 *      testnet, real (ephemeral) account.
 */
import { Keypair } from '@stellar/stellar-sdk'

const RUN_TESTNET_INTEGRATION = process.env.RUN_TESTNET_INTEGRATION === '1'
const HORIZON_TESTNET_URL = process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org'
const FRIENDBOT_URL = 'https://friendbot.stellar.org'

const maybeDescribe = RUN_TESTNET_INTEGRATION ? describe : describe.skip

/**
 * Retries a flaky async operation with exponential backoff. Only swallows
 * failures from `op` itself (network errors, transient 5xx/timeouts) — an
 * assertion failure inside `op` still throws immediately since `op` is
 * expected to only perform the network call, with assertions made on its
 * return value by the caller.
 */
async function withRetry<T>(
  op: () => Promise<T>,
  { attempts = 3, baseDelayMs = 500 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await op()
    } catch (err) {
      lastError = err
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)))
      }
    }
  }
  throw lastError
}

maybeDescribe('Testnet integration template: Horizon account lifecycle (Issue #102)', () => {
  // 5 minutes — funding + propagation across real testnet infra can be
  // slow, well beyond jest's 5s default.
  jest.setTimeout(5 * 60 * 1000)

  let keypair: Keypair

  beforeAll(() => {
    // A fresh keypair per run — nothing to provision or rotate in CI
    // secrets, and no shared fixture that could be left in a bad state by
    // a previous failed run.
    keypair = Keypair.random()
  })

  it('funds a fresh testnet account via Friendbot (real network call, no mocks)', async () => {
    const response = await withRetry(() =>
      fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(keypair.publicKey())}`),
    )

    // A real assertion against a real response — not retried, a failure
    // here is a genuine test failure, not flakiness.
    expect(response.ok).toBe(true)
  })

  it('reads the funded account back from Horizon testnet with the expected starting balance', async () => {
    const account = await withRetry(async () => {
      const res = await fetch(`${HORIZON_TESTNET_URL}/accounts/${keypair.publicKey()}`)
      if (!res.ok) {
        throw new Error(`Horizon returned ${res.status} for account lookup`)
      }
      return res.json()
    })

    expect(account.account_id).toBe(keypair.publicKey())
    const nativeBalance = account.balances?.find((b: { asset_type: string }) => b.asset_type === 'native')
    expect(nativeBalance).toBeDefined()
    // Friendbot funds new testnet accounts with 10,000 XLM.
    expect(Number(nativeBalance.balance)).toBeGreaterThanOrEqual(10_000)
  })

  it('rejects a lookup for an account that was never funded (real 404, not a mock)', async () => {
    const neverFunded = Keypair.random()

    const res = await withRetry(() => fetch(`${HORIZON_TESTNET_URL}/accounts/${neverFunded.publicKey()}`))

    expect(res.status).toBe(404)
  })
})
