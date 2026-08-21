/**
 * E2E: prefers-reduced-motion (Issue #89)
 *
 * Dialog/sheet/drawer open-close transitions (Radix's
 * data-[state=open]:animate-in / data-[state=closed]:animate-out, applied
 * via tw-animate-css) are the concrete animated surface this issue calls
 * out. This asserts the *actual computed* animation/transition duration on
 * a real dialog in the running app collapses to near-zero once the OS-level
 * `prefers-reduced-motion: reduce` preference is emulated, and is NOT
 * near-zero without it — proving the global override in globals.css
 * (`@media (prefers-reduced-motion: reduce) { *,*::before,*::after {...} }`)
 * actually reaches this component rather than just asserting the CSS rule
 * exists in the source.
 *
 * @tag reduced-motion issue-89
 */
import { test, expect } from '@playwright/test'

async function openTrustlineDialog(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Manage Trustlines' }).click()
  return page.getByRole('dialog')
}

test.describe('prefers-reduced-motion — Issue #89 @reduced-motion', () => {
  test('dialog open transition duration collapses to near-zero when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    const dialog = await openTrustlineDialog(page)
    await expect(dialog).toBeVisible()

    const { animationDuration, transitionDuration } = await dialog.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
      }
    })

    for (const raw of [animationDuration, transitionDuration]) {
      // Computed durations are comma-separated per animated property
      // (e.g. "0.01ms, 0.01ms"). Every one of them must be ~0.
      const values = raw.split(',').map((v) => v.trim())
      for (const value of values) {
        const ms = value.endsWith('ms')
          ? parseFloat(value)
          : parseFloat(value) * 1000
        expect(ms).toBeLessThanOrEqual(1)
      }
    }
  })

  test('dialog open animation has a real non-zero duration without reduced motion (sanity control)', async ({ page }) => {
    // No emulateMedia call: default Playwright browser context has no
    // reduced-motion preference forced, so this exercises the app's normal
    // (non-accessibility-adjusted) animation timing as a control — proving
    // the near-zero result above comes from the media query, not from the
    // dialog having no animation at all. DialogContent's `animate-in
    // duration-200` (dialog.tsx) drives this via `animation-duration`, so
    // that's the property this control checks (transition-duration is 0s
    // either way since Radix's open/close state uses keyframe animations,
    // not CSS transitions, on this component).
    const dialog = await openTrustlineDialog(page)
    await expect(dialog).toBeVisible()

    const animationDuration = await dialog.evaluate(
      (el) => getComputedStyle(el).animationDuration,
    )
    const values = animationDuration.split(',').map((v) => v.trim())
    const anyNonTrivial = values.some((value) => {
      const ms = value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000
      return ms > 1
    })
    expect(anyNonTrivial).toBe(true)
  })
})
