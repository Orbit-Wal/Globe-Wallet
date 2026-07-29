# TODO: Issue #72 — Conversion Math Fixed-Point Migration

## Steps

- [x] 1. Install decimal.js and @types/decimal.js
- [x] 2. Rewrite `lib/helpers/conversion-math.ts` with Decimal.js fixed-point arithmetic
- [x] 3. Update `tests/unit/lib/conversion-math.test.ts` with round-trip and rounding-mode tests
- [ ] 4. Update `app/convert/page.tsx` to use fixed-point helpers instead of inline float math
- [ ] 5. Run `npm test` to verify no regressions
- [ ] 6. Run `npm run test:coverage` to verify coverage
- [ ] 7. Generate PR description
