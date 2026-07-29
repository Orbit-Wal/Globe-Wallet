# Transaction Query Performance & Indexing Design

## Complexity Analysis: Current Implementation

### Time Complexity
The `filterAndSortTransactions` function in `lib/transaction-utils.ts` has a time complexity of **O(n log n)**, where n is the total number of transactions.

Breakdown:
1. Filtering: Each filter (type, category, asset, status, search, from, to) is O(n). In the worst case, all 7 filters are applied, leading to O(7n) = O(n).
2. Sorting: Uses a comparison sort (Array.prototype.sort), which is O(n log n) in the average and worst case. This dominates the overall complexity.

### Space Complexity
Space complexity is **O(n)** because we create a copy of the filtered array before sorting.

---

## Database Indexing Strategy (For Future Migration)

### Recommended Table Structure & Indexes
When migrating `mock-db.ts` to a real database (PostgreSQL recommended), use this table structure and indexing:

```sql
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    asset TEXT NOT NULL,
    currency TEXT,
    address TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    stellar_hash TEXT,
    category TEXT,
    name TEXT,
    detail TEXT
);

-- Indexes for filter fields
CREATE INDEX idx_transactions_date ON transactions (date DESC);
CREATE INDEX idx_transactions_asset ON transactions (asset);
CREATE INDEX idx_transactions_status ON transactions (status);
CREATE INDEX idx_transactions_category ON transactions (category);
CREATE INDEX idx_transactions_type ON transactions (type);
CREATE INDEX idx_transactions_search ON transactions USING GIN (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(detail, '') || ' ' || address || ' ' || asset || ' ' || coalesce(stellar_hash, ''))
);
```

### Filter to Indexed WHERE Clause Translation

| Filter Field | Indexed WHERE Clause | Notes |
|--------------|----------------------|-------|
| `type` | `type = $1` | Uses `idx_transactions_type`; maps to Transaction's type field (needs to compute direction via type) |
| `category` | `category = $1` | Uses `idx_transactions_category` |
| `asset` | `asset = $1` | Uses `idx_transactions_asset` |
| `status` | `status = $1` | Uses `idx_transactions_status` |
| `from` | `date >= $1` | Uses `idx_transactions_date` |
| `to` | `date <= $1` | Uses `idx_transactions_date` |
| `search` | `to_tsvector('english', coalesce(name, '') || ' ' || coalesce(detail, '') || ' ' || address || ' ' || asset || ' ' || coalesce(stellar_hash, '')) @@ plainto_tsquery('english', $1)` | Uses `idx_transactions_search` (full-text search) |

### Sorting Strategy
For sorting, use:
- Sort by `date`: Use `ORDER BY date $2` (uses `idx_transactions_date`)
- Sort by `amount`: Use `ORDER BY amount $2` (no dedicated index needed if filtered first, or add `idx_transactions_amount` if needed)
- Sort by `asset`: Use `ORDER BY asset $2` (uses `idx_transactions_asset`)

### Pagination
Use `LIMIT $3 OFFSET $4` or cursor-based pagination with `id` and `date` for better performance on large datasets.
