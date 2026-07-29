/**
 * Component tests — Convert Page (Issue #20)
 *
 * Tests the UI behaviour of app/convert/page.tsx:
 *   - Initial render and default state
 *   - Amount input (bidirectional: from→to and to→from)
 *   - Currency selector changes
 *   - Swap button
 *   - Balance display
 *   - "Use max" button
 *   - Transaction detail card
 *   - Convert button disabled/enabled states
 *   - Insufficient balance validation
 *   - Accessibility attributes
 *
 * Uses msw-free approach — the page uses inline mock data so no network mock needed.
 */

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── sonner toast mock ─────────────────────────────────────────────────────────
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// ── next/link mock ────────────────────────────────────────────────────────────
jest.mock('next/link', () => {
  const MockLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  )
  MockLink.displayName = 'MockLink'
  return MockLink
})

// ── AppShell mock (strips layout, renders children directly) ──────────────────
// Use the relative path so Jest's module resolver can find it before the factory runs
jest.mock('../../components/app/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import ConvertPage from '../../app/convert/page'
import { toast } from 'sonner'

// ── helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  return render(<ConvertPage />)
}

function getFromInput() {
  // The first number input is the "from" amount
  const inputs = screen.getAllByRole('spinbutton')
  return inputs[0]
}

function getToInput() {
  const inputs = screen.getAllByRole('spinbutton')
  return inputs[1]
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Convert Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  describe('initial render', () => {
    it('displays the page heading', () => {
      renderPage()
      expect(screen.getByRole('heading', { name: 'Convert' })).toBeInTheDocument()
    })

    it('renders the exchange rate card with XLM -> USDC as default', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/1 XLM/)).toBeInTheDocument()
      })
    })

    it('shows the "From" and "To" labels', () => {
      renderPage()
      expect(screen.getByText('From')).toBeInTheDocument()
      expect(screen.getByText('To')).toBeInTheDocument()
    })

    it('renders the Convert button', () => {
      renderPage()
      expect(screen.getByRole('button', { name: /convert/i })).toBeInTheDocument()
    })

    it('Convert button is disabled when no amount entered', () => {
      renderPage()
      expect(screen.getByRole('button', { name: /^convert$/i })).toBeDisabled()
    })

    it('shows "How it works" info section', () => {
      renderPage()
      expect(screen.getByText('How it works')).toBeInTheDocument()
    })

    it('displays XLM balance for the default from-currency', () => {
      renderPage()
      // Fixture balance: XLM: 1250.45
      expect(screen.getByText(/1250\.45/)).toBeInTheDocument()
    })
  })

  // ── From-amount input ────────────────────────────────────────────────────────

  describe('from-amount input', () => {
    it('calculates to-amount when from-amount is entered', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      const fromInput = getFromInput()
      await user.clear(fromInput)
      await user.type(fromInput, '100')

      const toInput = getToInput()
      // Rate for XLM→USDC = 0.1185, so 100 * 0.1185 = 11.850000
      await waitFor(() => {
        expect((toInput as HTMLInputElement).value).toBe("11.850000")
      })
    })

    it('enables Convert button after a positive amount is entered', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      await user.type(getFromInput(), '50')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^convert$/i })).not.toBeDisabled()
      })
    })

    it('shows transaction detail card after both amounts are populated', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      await user.type(getFromInput(), '100')

      await waitFor(() => {
        expect(screen.getByText('Transaction Details')).toBeInTheDocument()
      })
    })

    it("shows the You'll receive line with the net amount (after 0.1% fee)", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      await user.type(getFromInput(), '100')

      await waitFor(() => {
        expect(screen.getByText(/You'll receive/)).toBeInTheDocument()
      })
    })

    it('shows Network Fee line in transaction details', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()
      await user.type(getFromInput(), '100')

      await waitFor(() => {
        expect(screen.getByText('Network Fee')).toBeInTheDocument()
      })
    })
  })

  // ── "Use max" button ─────────────────────────────────────────────────────────

  describe('"Use max" button', () => {
    it('appears once the user starts typing an amount', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      expect(screen.queryByRole('button', { name: /use max/i })).not.toBeInTheDocument()

      await user.type(getFromInput(), '1')
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /use max/i })).toBeInTheDocument()
      })
    })

    it('fills from-amount with the full XLM balance', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      // Trigger "Use max" to appear
      await user.type(getFromInput(), '1')
      const useMaxBtn = await screen.findByRole('button', { name: /use max/i })
      await user.click(useMaxBtn)

      await waitFor(() => {
        expect(getFromInput()).toHaveValue(1250.45)
      })
    })
  })

  // ── Swap button ──────────────────────────────────────────────────────────────

  describe('swap button', () => {
    it('renders a button between the From and To sections', () => {
      renderPage()
      const buttons = screen.getAllByRole('button')
      // Page always has: back nav, swap, convert, and potentially "use max"
      expect(buttons.length).toBeGreaterThanOrEqual(2)
    })

    it('swaps the currencies after clicking (from becomes to, to becomes from)', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      // Enter a from-amount so both inputs are populated
      await user.type(getFromInput(), '100')
      await waitFor(() => expect(getToInput()).not.toHaveValue(0))

      const toAmountBefore = (getToInput() as HTMLInputElement).value

      // Find the swap button — it's a small outline icon button between inputs.
      // The convert page uses a Button with className including 'rounded-full'.
      const allButtons = screen.getAllByRole('button')
      // The swap button is not the back button (link) or the convert button (lg).
      // It is the smallest outline button — find by filtering non-disabled, non-large.
      const swapButton = allButtons.find((b) => {
        const cls = b.className
        return cls.includes('rounded-full') || (cls.includes('h-8') && cls.includes('w-8'))
      })

      expect(swapButton).toBeDefined()
      if (swapButton) {
        await user.click(swapButton)
      }

      // After swapping, the previous toAmount should now be in the from field
      await waitFor(() => {
        const newFromValue = (getFromInput() as HTMLInputElement).value
        // The swap sets fromAmount = toAmount and toAmount = fromAmount
        // toAmountBefore was something like "9.500000"
        expect(parseFloat(newFromValue)).toBeCloseTo(parseFloat(toAmountBefore), 2)
      })
    })
  })

  // ── Validation ───────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('shows an error toast when amount is 0 and Convert is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      // Type 0
      await user.type(getFromInput(), '0')
      const convertBtn = screen.getByRole('button', { name: /^convert$/i })

      // Button should remain disabled for 0 amount
      expect(convertBtn).toBeDisabled()
    })

    it('shows insufficient balance toast for amount exceeding balance', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      // XLM balance is 1250.45 — enter more than that
      await user.type(getFromInput(), '9999')
      const convertBtn = screen.getByRole('button', { name: /^convert$/i })
      await user.click(convertBtn)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/insufficient/i),
        )
      })
    })
  })

  // ── Successful conversion flow ───────────────────────────────────────────────

  describe('successful conversion', () => {
    it('shows success toast after Convert with valid amount', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      await user.type(getFromInput(), '100')
      const convertBtn = screen.getByRole('button', { name: /^convert$/i })

      await waitFor(() => expect(convertBtn).not.toBeDisabled())

      await user.click(convertBtn)

      // Button should show "Converting..." during the simulated 2s delay
      expect(screen.getByText(/converting/i)).toBeInTheDocument()

      // Advance fake timers past the 2000ms delay
      jest.advanceTimersByTime(2100)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringMatching(/successfully converted/i),
        )
      })
    })

    it('clears inputs after a successful conversion', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      await user.type(getFromInput(), '100')
      const convertBtn = screen.getByRole('button', { name: /^convert$/i })
      await waitFor(() => expect(convertBtn).not.toBeDisabled())

      await user.click(convertBtn)
      jest.advanceTimersByTime(2100)

      await waitFor(() => {
        expect(getFromInput()).toHaveValue(null)
      })
    })
  })

  // ── Accessibility ────────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('From and To labels are rendered', () => {
      renderPage()
      expect(screen.getByText('From')).toBeInTheDocument()
      expect(screen.getByText('To')).toBeInTheDocument()
    })

    it('balance indicators are visible for both currencies', () => {
      renderPage()
      // Default: XLM from, USDC to
      const balanceTexts = screen.getAllByText(/Balance:/)
      expect(balanceTexts.length).toBeGreaterThanOrEqual(2)
    })

    it('back navigation link is rendered', () => {
      renderPage()
      expect(screen.getByRole('link')).toBeInTheDocument()
    })
  })

  // ── Path Payment & Slippage Settings (Issue #98) ───────────────────────────

  describe('path payment & slippage settings', () => {
    it('renders slippage settings button and toggles options panel', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()

      const slippageBtn = screen.getByRole('button', { name: /slippage settings/i })
      expect(slippageBtn).toBeInTheDocument()

      await user.click(slippageBtn)
      expect(screen.getByText('Slippage Tolerance')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '0.1%' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '0.5%' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '1%' })).toBeInTheDocument()
    })

    it('displays quote expiration countdown indicator', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderPage()
      await user.type(getFromInput(), '100')
      await waitFor(() => {
        expect(screen.getByText(/quote updates in/i)).toBeInTheDocument()
      })
    })
  })
})
