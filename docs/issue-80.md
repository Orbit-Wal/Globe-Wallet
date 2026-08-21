# Transaction Retention & Pagination Policy (Issue #80)

## The bug this documents

`MockDB.saveTransaction` (`lib/db/mock-db.ts`) does `this.transactions.unshift(tx)`
with no cap, no eviction, and no persistence boundary. In a long-lived process
(a warm `next dev`/`next start` server, or any deployment that doesn't restart
per-request) this array grows for the lifetime of the process. `queryTransactions`
still returns correct paginated slices at any size, but the *storage* itself is
unbounded, and every stored transaction is retained in memory forever.

This is invisible in the existing test suite because `MOCK_TRANSACTIONS_COMPACT`
seeds a small fixed set and most tests never call `saveTransaction` in a loop.
`tests/unit/db/mock-db.test.ts` now has a dedicated test (see below) that
proves the growth concretely, so this isn't just an assertion in a doc.

This is **not** fixed by capping `mock-db.ts`'s in-memory array. `mock-db.ts`
is explicitly a placeholder for a real datastore (see #64, #65, #68's Definition
of done — the whole persistence layer is scoped to be replaced, not patched in
place). Capping it here would hide the real problem behind fixture-scale
behavior again, exactly the failure mode this issue is calling out. Instead,
this is the written retention/pagination policy the real datastore must
implement when it replaces `mock-db.ts`.

## Retention policy (for the real datastore)

1. **No unbounded retention in the hot table.** Transactions are financial
   records — they cannot be silently dropped — but they also cannot live
   forever in the primary query path. Two-tier retention:
   - **Hot tier** (primary `transactions` table, see
     `docs/transaction-query-performance.md` for the indexed schema): retain
     the most recent **N = 5,000 transactions per account** or **24 months**,
     whichever is larger, directly queryable with the existing indexes.
   - **Cold tier**: transactions older than the hot-tier window are archived
     (e.g. exported to object storage as append-only, date-partitioned
     files, or moved to a partitioned `transactions_archive` table) rather
     than deleted. Financial/audit requirements generally mandate retaining
     transaction records for several years even if they're rarely queried.
   - Archival is a scheduled job (not inline in `saveTransaction`), since
     eviction-on-write would add write-path latency to every payment.

2. **Per-account bound, not global.** The bound must be scoped per account
   (`WalletAccountSchema.id` in the real accounts table), not a single global
   array like today's mock. A global cap would let one noisy account crowd
   out another account's history.

3. **`queryTransactions` keeps its existing contract.** `TransactionFilters`
   (`limit`, `offset`, plus the type/category/asset/status/search/date
   filters already implemented in `lib/transaction-utils.ts`) already forms a
   correct pagination contract — `hasMore`/`total`/`offset`/`limit` — that
   should carry over unchanged to a real `WHERE ... ORDER BY date DESC LIMIT
   $1 OFFSET $2` implementation. Callers (`useTransactions`, `/api/transactions`,
   `/api/wallet/transactions`) do not need to change when the backing store
   changes, only `mock-db.ts`'s replacement does.

4. **Cursor pagination for the hot path, offset pagination is a stopgap.**
   `OFFSET` degrades on large tables. Once real persistence lands, the
   recommendation in `docs/transaction-query-performance.md` (cursor-based
   pagination keyed on `(date, id)`) should replace `offset`-based paging in
   `TransactionFilters`, with `offset` kept only as a back-compat fallback
   for any caller not yet updated.

5. **No retention exceptions for "pending" transactions.** A transaction
   that never resolved past `pending` still counts toward the account's
   retention window — it must not be silently garbage collected, since a
   stuck pending transaction is itself an operational signal that needs to
   stay queryable.

## What this issue deliberately does not do

- It does not add a cap/eviction to `MockDB` itself. See "not fixed by
  capping mock-db.ts" above — that would mask the actual problem.
- It does not implement the real datastore. That's the scope of the broader
  persistence-layer work referenced by #64/#65/#68.
