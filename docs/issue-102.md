# Issue #102 — testing pattern for future real integrations

## The gap

Every planned mock-to-real migration this repo has open (Soroban calls,
Horizon submission, federation SEP-2, SEP-24 off-ramp) will eventually need
tests that hit a real testnet endpoint, not a mock/fixture. The entire
current suite is deliberately mocked and deterministic — correct for
unit/component tests and most integration tests, but there was no
established pattern for the tests that *do* need to be network-real, and no
CI story for how those would run without either (a) blocking every PR on
third-party testnet uptime, or (b) requiring a funded account secret nobody
owns rotating/topping up.

## Strategy

**Separate job.** `testnet-integration` in `.github/workflows/ci.yml` runs
after (`needs:`) the main `test` job, hits real network infra, and is marked
`continue-on-error: true` — a Horizon testnet or Friendbot outage can never
block a merge the way an actual regression in `test` does. The main `test`
job (and `npm test` locally) never depends on outbound network access.

**Opt-in gating, not directory exclusion.** Testnet-backed tests live under
`tests/integration/testnet/` and are named `*.testnet.test.ts`, but nothing
about that location is what skips them — every such file gates its
`describe` block on `process.env.RUN_TESTNET_INTEGRATION === '1'`
(`describe.skip` otherwise). That means:
  - `npm run test:integration` / `npm test` still discover the files (no
    jest config exclusion to keep in sync) but every test inside reports as
    *skipped*, never *failed*, when the flag isn't set.
  - `npm run test:testnet` sets the flag and runs just that directory —
    this is what the CI job (and any contributor working on a real
    integration) actually runs.

**Funded account provisioning: generate + Friendbot, not a stored secret.**
The template test (`horizon-account.testnet.test.ts`) generates a fresh
`Keypair` per run and funds it through Stellar's own Friendbot
(`https://friendbot.stellar.org`) — there is no `STELLAR_TESTNET_SECRET_KEY`
or similar to provision, rotate, or leak. This sidesteps "who tops the
funded fixture account back up" entirely. If a future integration needs an
account with pre-existing history/trustlines that Friendbot alone can't set
up, extend the `beforeAll` in that test to perform the setup transactions
itself (still against a freshly generated account) rather than reaching for
a long-lived stored secret.

**Retry policy lives in the test, not the job.** `withRetry()` in the
template wraps only the network call with exponential backoff (3 attempts,
500ms base delay) — a real assertion failure inside the wrapped callback is
never silently retried away, only the network call itself is. This was
chosen over a job-level retry (e.g. `nick-fields/retry-action`) because a
job-level retry re-runs *everything*, including tests that already passed,
which hides which specific network call was actually flaky.

## Applying this to the next real integration

1. Add `tests/integration/testnet/<name>.testnet.test.ts` following the
   same shape: `RUN_TESTNET_INTEGRATION` gate, `withRetry` around each real
   network call, a `beforeAll` that provisions whatever fixture state is
   needed (prefer generating it fresh over a stored secret, per above).
2. Nothing else needs to change — `npm run test:testnet` and the
   `testnet-integration` CI job already pick up any file matching
   `tests/integration/testnet/**`.
3. Federation SEP-2 specifically: the template test targets Horizon testnet
   directly instead of a federation lookup, because a federation test
   necessarily targets a *third party's* domain (`user*their-domain.tld`)
   and this repo doesn't operate one — a federation template would depend
   on some external fixture domain's indefinite uptime, which isn't
   something this repo controls. Once a stable federation target exists
   (e.g. a fixture domain the team stands up), the same gating/retry/
   real-fetch pattern applies directly; only the "what am I calling" step
   changes.
