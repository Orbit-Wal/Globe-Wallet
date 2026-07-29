import { test, expect } from '@playwright/test'

test.describe('Finance Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display balance information correctly', async ({ page }) => {
    await page.waitForSelector('[data-testid="balance-card"]', { timeout: 10000 })

    const balanceCard = page.locator('[data-testid="balance-card"]')
    await expect(balanceCard).toBeVisible()

    const totalValue = page.locator('[data-testid="total-value"]')
    await expect(totalValue).toBeVisible()

    const fiatTotal = page.locator('[data-testid="fiat-total"]')
    const cryptoTotal = page.locator('[data-testid="crypto-total"]')

    await expect(fiatTotal).toBeAttached()
    await expect(cryptoTotal).toBeAttached()
  })

  test('should toggle balance visibility', async ({ page }) => {
    await page.waitForSelector('[data-testid="balance-card"]')

    const toggle = page.getByTestId('toggle-balance-visibility')
    await toggle.click()

    const totalValue = page.locator('[data-testid="total-value"]')
    await expect(totalValue).toContainText('••••')
  })

  test('should display transaction list', async ({ page }) => {
    const transactionList = page.locator('[data-testid="transaction-list"]')
    await expect(transactionList).toBeVisible({ timeout: 10000 })

    const transactions = page.locator('[data-testid^="transaction-"]')
    await expect(transactions.first()).toBeVisible()
  })

  test('should handle error states gracefully', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort())
    // Wait for the reload to commit instead of sleeping a fixed 2s. The
    // assertions below already retry until the shell renders, so they stay
    // valid regardless of how long the aborted requests take to settle —
    // including once the API is a real backend with variable latency.
    await page.reload({ waitUntil: 'domcontentloaded' })

    const body = page.locator('body')
    await expect(body).toBeVisible()
    await expect(page.getByTestId('balance-card')).toBeVisible({ timeout: 10000 })
  })
})
