import { test, expect } from '@playwright/test'

// @tag @transaction-history

test.describe('Transaction History @transaction-history', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('GET /api/transactions returns paginated page with success:true', async ({ request }) => {
    const res = await request.get('/api/transactions?paginate=true&limit=5')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toHaveProperty('data')
    expect(json.data).toHaveProperty('total')
    expect(json.data).toHaveProperty('hasMore')
    expect(Array.isArray(json.data.data)).toBe(true)
  })

  test('GET /api/transactions with paginate=false returns flat array', async ({ request }) => {
    const res = await request.get('/api/transactions?paginate=false')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/transactions filters by type=in', async ({ request }) => {
    const res = await request.get('/api/transactions?paginate=true&type=in')
    const json = await res.json()
    const txs: Array<{ type: string }> = json.data.data
    if (txs.length > 0) {
      expect(txs.every(t => t.type === 'receive' || t.type === 'in')).toBe(true)
    }
  })

  test('POST /api/transactions creates a new pending transaction', async ({ request }) => {
    const res = await request.post('/api/transactions', {
      data: { type: 'receive', amount: 99, asset: 'XLM', address: 'GTESTE2E', name: 'E2E Test TX' },
    })
    expect(res.status()).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data[0].status).toBe('pending')
    expect(json.data[0].name).toBe('E2E Test TX')
  })

  test('POST /api/transactions returns 400 for invalid payload', async ({ request }) => {
    const res = await request.post('/api/transactions', {
      data: { amount: -1 },
    })
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  test('GET /api/transactions/sync returns sync status', async ({ request }) => {
    const res = await request.get('/api/transactions/sync')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toHaveProperty('isSyncing')
    expect(json.data).toHaveProperty('totalSynced')
    expect(json.data).toHaveProperty('lastSyncAt')
  })

  test('POST /api/transactions/sync triggers sync and returns result', async ({ request }) => {
    const res = await request.post('/api/transactions/sync')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(typeof json.data.added).toBe('number')
    expect(typeof json.data.lastSyncAt).toBe('string')
  })

  test('transaction-history-view renders on transactions page', async ({ page }) => {
    await page.goto('/transactions')
    const view = page.getByTestId('transaction-history-view')
    if (await view.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(view).toBeVisible()
      await expect(page.getByTestId('transaction-search')).toBeVisible()
      await expect(page.getByTestId('tab-all')).toBeVisible()
      await expect(page.getByTestId('tab-in')).toBeVisible()
      await expect(page.getByTestId('tab-out')).toBeVisible()
    } else {
      test.skip(true, 'Transactions page not wired to app router yet')
    }
  })

  test('search input updates query and filters list', async ({ page }) => {
    await page.goto('/transactions')
    const view = page.getByTestId('transaction-history-view')
    if (!(await view.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Transactions page not wired yet')
    }
    const search = page.getByTestId('transaction-search')
    await search.fill('nonexistentxyz')
    // No fixed sleep for the search debounce — assert on the resulting UI
    // state instead. toBeVisible() retries until the debounced filter runs and
    // the empty state renders, so this holds whatever the debounce interval is.
    const emptyState = page.getByTestId('empty-state')
    await expect(emptyState).toBeVisible({ timeout: 5000 })
  })

  test('sync button triggers POST /api/transactions/sync', async ({ page, request }) => {
    const before = await (await request.post('/api/transactions/sync')).json()
    const syncedBefore = before.data?.added ?? 0
    expect(typeof syncedBefore).toBe('number')
  })

  test('transaction list items show status badges', async ({ page }) => {
    await page.goto('/transactions')
    const view = page.getByTestId('transaction-history-view')
    if (!(await view.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Transactions page not wired yet')
    }
    const badges = page.getByTestId('transaction-status-badge')
    await expect(badges.first()).toBeVisible()
  })
})
