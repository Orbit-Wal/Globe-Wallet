# Dependency vulnerability gate

Globe Wallet treats npm advisory noise as a merge blocker for a financial app.
CI runs `npm run audit:gate` after install and fails the job when any finding at
or above the configured severity threshold is not explicitly allowlisted.

## What was fixed (original report)

`npm audit` previously reported **2 vulnerabilities (1 moderate, 1 high)**:

| Package | Severity | Advisory | Resolution |
| --- | --- | --- | --- |
| `next@16.0.10` | high (aggregate) | Multiple Next.js DoS / CSRF / middleware bypass advisories (e.g. GHSA-h25m-26qc-wcjf) | Upgraded to `next@16.2.10` (and matching `@next/swc-linux-x64-gnu`) |
| `postcss@<8.5.10` (nested under `next`) | moderate | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) XSS via unescaped `</style>` in CSS stringify | Forced `postcss@8.5.19` via `package.json` `overrides` (and direct pin) because Next still declares `postcss@8.4.31` |

No advisories were accepted as risk for the original report — both were patched.
The allowlist file exists so future exceptions require an explicit, documented,
time-bounded entry rather than silently ignoring audit failures.

## How the gate works

1. `scripts/npm-audit-gate.mjs` runs `npm audit --json`.
2. Findings are evaluated by `lib/security/npm-audit-gate.mjs` against
   `security/npm-audit-allowlist.json`.
3. Advisory `range` fields are checked against the installed package version so
   patched releases are not blocked by stale aggregate ranges.
4. Default threshold is **`moderate`** (fails on moderate, high, and critical).
5. An exception is accepted only when it includes:
   - `id` and/or `package` — advisory id (e.g. `GHSA-…`) and/or package name
   - `reason` — non-empty accepted-risk rationale
   - optional `expires` — `YYYY-MM-DD`; expired entries stop matching

## Adding an accepted exception

Only when a patch is unavailable or would introduce a worse risk:

```json
{
  "threshold": "moderate",
  "exceptions": [
    {
      "id": "GHSA-xxxx-xxxx-xxxx",
      "package": "example-package",
      "reason": "No patched release yet; usage is build-time only and not reachable from request path. Tracked in issue #N.",
      "expires": "2026-12-31"
    }
  ]
}
```

Exceptions without a `reason`, or with an expired `expires` date, do **not**
silence the finding.

## Local commands

```bash
npm audit
npm run audit:gate
npx jest tests/unit/security/npm-audit-gate.test.ts
```
