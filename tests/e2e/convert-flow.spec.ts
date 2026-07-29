/**
 * E2E — Convert Flow (issue #25)
 * Covers: rate display, amount input, swap currencies, fee summary, convert button.
 */
import { test, expect } from '@playwright/test'

test.describe('Convert Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/convert')
  })

  // ── Happy path ─────────────────────────────────────────────────────────────

  test('happy path: enter amount, see calculated result, convert successfully', async ({ page }) => {
    // Page should load with heading
    await expect(page.getByRole('heading', { name: 'Convert' })).toBeVisible()

    // Exchange rate card should show default XLM → USDC rate
    await expect(page.getByText(/1 XLM/)).toBeVisible()

    // Get the from-amount input (first number input on the page)
    const fromInput = page.locator('input[type="number"]').first()
    await fromInput.fill('100')

    // The to-amount field should auto-populate (rate 0.095 → 9.500000)
    const toInput = page.locator('input[type="number"]').nth(1)
    await expect(toInput).not.toHaveValue('')
    const toValue = await toInput.inputValue()
    expect(parseFloat(toValue)).toBeGreaterThan(0)

    // Transaction details card should appear
    await expect(page.getByText('Transaction Details')).toBeVisible()
    await expect(page.getByText(/You'll receive/)).toBeVisible()

    // Convert button should be enabled
    const convertButton = page.getByRole('button', { name: /^convert$/i })
    await expect(convertButton).toBeEnabled()

    // Submit conversion
    await convertButton.click()

    // Button shows loading state (condition-based, not a fixed wait)
    await expect(page.getByText(/converting/i)).toBeVisible()

    // Wait on the success toast itself, not a fixed delay. The 8s ceiling is a
    // generous upper bound that absorbs real, variable network latency once the
    // mocked conversion delay is replaced with a live call — the assertion
    // resolves as soon as the toast appears, no matter how fast or slow.
    await expect(page.getByText(/successfully converted/i)).toBeVisible({ timeout: 8000 })
  })

  // ── Failure path ───────────────────────────────────────────────────────────

  test('failure path: exceeding balance shows error toast', async ({ page }) => {
    // Default XLM balance is 1250.45 — enter a higher value
    const fromInput = page.locator('input[type="number"]').first()
    await fromInput.fill('99999')

    const convertButton = page.getByRole('button', { name: /^convert$/i })
    await expect(convertButton).toBeEnabled()
    await convertButton.click()

    // Error toast should appear
    await expect(page.getByText(/insufficient/i)).toBeVisible({ timeout: 5000 })
  })

  // ── Bidirectional input ────────────────────────────────────────────────────

  test('to-amount input back-calculates the from-amount', async ({ page }) => {
    const toInput = page.locator('input[type="number"]').nth(1)
    await toInput.fill('9.5')

    const fromInput = page.locator('input[type="number"]').first()
    const fromValue = await fromInput.inputValue()

    // 9.5 / 0.095 ≈ 100
    expect(parseFloat(fromValue)).toBeCloseTo(100, 0)
  })

  // ── "Use max" ──────────────────────────────────────────────────────────────

  test('"Use max" button fills the from-amount with the full balance', async ({ page }) => {
    // Type any amount to trigger "Use max" button appearance
    const fromInput = page.locator('input[type="number"]').first()
    await fromInput.fill('1')

    const useMaxButton = page.getByRole('button', { name: /use max/i })
    await expect(useMaxButton).toBeVisible()
    await useMaxButton.click()

    // Should equal the XLM balance (1250.45)
    const value = await fromInput.inputValue()
    expect(parseFloat(value)).toBeCloseTo(1250.45, 1)
  })
})
