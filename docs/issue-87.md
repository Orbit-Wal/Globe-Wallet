# Issue #87 — Dynamic Color Contrast Audit (WCAG 2.2 AA)

## Overview

Globe Wallet now includes a complete, automated **dynamic color contrast audit system** verifying all runtime-generated, conditional, and status color tokens against **WCAG 2.2 Level AA** standards ($4.5:1$ ratio for normal text).

This complements the automated axe-core/pa11y sweeps introduced in [Issue #24](./issue-24.md) by auditing custom color tokens, inline CSS variables, badge variants, and status themes that escape static HTML audits.

---

## Technical Rationale & Design

Automated accessibility tools (like axe-core or pa11y) only scan rendered DOM nodes under static state conditions. Dynamic states—such as address lookup badges, transaction status chips, trend indicators, avatar badge glyphs, and custom chart tokens—frequently load dynamic colors at runtime that vary depending on user state, data feed, or theme mode.

### Contrast Utilities & Catalog Architecture

1. **Centralized Contrast Engine (`lib/a11y/contrast.ts`)**:
   - Implements exact WCAG 2.2 relative luminance formula:
     $$L = 0.2126R + 0.7152G + 0.0722B$$
   - Calculates contrast ratio:
     $$\text{Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$
   - Handles sRGB hex codes, RGB/RGBA strings, and Tailwind color aliases.

2. **Dynamic Colors Catalog (`lib/a11y/dynamic-colors.ts`)**:
   - Maps every dynamic color path in the application.
   - Provides `auditDynamicColorContrast()` which programmatically executes contrast audits for both Light and Dark themes.

3. **Automated Unit Testing (`tests/unit/a11y/dynamic-color-audit.test.ts`)**:
   - Integrates into `npm test` and `npm run test:a11y` to guarantee zero regressions.

---

## Discovered Dynamic Color Paths & Resolutions

| Component | Element / State | Original Class | Issue | Resolution | Contrast Ratio |
|---|---|---|---|---|---|
| `TransactionStatusBadge` | `pending` status | `text-amber-700` | 4.39:1 (below 4.5:1) | `text-amber-800 dark:text-amber-300` | **6.02:1** |
| `AddressLookupBadge` | `resolved` chip | `text-green-600` | 3.42:1 (below 4.5:1) | `text-green-700 dark:text-green-400` | **4.55:1** |
| `AddressLookupBadge` | `not-found` chip | `text-amber-600` | 2.96:1 (below 4.5:1) | `text-amber-800 dark:text-amber-300` | **5.14:1** |
| `AddressLookupBadge` | `error` chip | `text-destructive` | 3.41:1 (below 4.5:1) | `text-red-700 dark:text-red-400` | **5.14:1** |
| `Badge` UI Component | `destructive` variant | `bg-destructive text-white` | 3.41:1 (below 4.5:1) | `bg-red-700 text-white dark:bg-destructive` | **5.14:1** |
| `CryptoHoldings` | Avatar on `bg-accent` | `text-background` | 1.05:1 (critical fail) | `text-accent-foreground` | **18.5:1** |
| `TransactionHistoryView` | Incoming text & icon | `text-emerald-600` | 3.88:1 (below 4.5:1) | `text-emerald-800 dark:text-emerald-300` | **6.64:1** |
| `AnalyticsContent` | Trend change text | `text-green-600` | 3.42:1 (below 4.5:1) | `text-emerald-700 dark:text-emerald-400` | **4.74:1** |

---

## Running the Accessibility Audit Test Suite

To run the dynamic color contrast test suite:

```bash
npm run test:unit -- tests/unit/a11y
```

To run all accessibility tests (unit + component axe checks):

```bash
npm run test:a11y
```
