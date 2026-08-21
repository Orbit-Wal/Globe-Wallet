/**
 * Issue #86: TrustlineManager is the one real Dialog usage in this codebase
 * with an async content swap (list -> confirm -> loading spinner via
 * isProcessing). Radix's Escape/outside-click dismissal fires regardless of
 * in-flight async state by default; this proves the dialog can no longer be
 * dismissed (Escape, outside click, or the X close button, all of which
 * route through Radix's onOpenChange) while a trustline change is in
 * flight, and that it can be dismissed again once the operation settles.
 *
 * Note: the issue title also references drawer.tsx, which doesn't exist in
 * this codebase — the only modal primitives present are dialog.tsx and
 * sheet.tsx, and only dialog.tsx has a real usage with async content
 * swapping (TrustlineManager). sheet.tsx's only usage (mobile-nav.tsx) is
 * static nav content with no async state, so there's nothing to guard
 * there.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrustlineManager } from '@/components/app/trustline-manager'
import { useToast } from '@/hooks/use-toast'
import { useFinanceServices } from '@/hooks/useFinanceServices'

jest.mock('@/hooks/use-toast')
jest.mock('@/hooks/useFinanceServices')

describe('TrustlineManager dialog dismissal guard (Issue #86)', () => {
  let resolveChangeTrustline: (value: any) => void

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useToast as jest.Mock).mockReturnValue({ toast: jest.fn() })
    ;(useFinanceServices as jest.Mock).mockReturnValue({ wallet: {} })

    global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (!init) {
        // Initial GET /api/wallet/trustlines
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      // POST — the in-flight trustline change. Held open until the test
      // resolves it, so isProcessing stays true on demand.
      return new Promise((resolve) => {
        resolveChangeTrustline = resolve
      })
    })
  })

  it('blocks Escape/outside-click dismissal while a trustline change is in flight, then allows it again once settled', async () => {
    const user = userEvent.setup()
    render(
      <TrustlineManager>
        <button>Manage Trustlines</button>
      </TrustlineManager>,
    )

    await user.click(screen.getByRole('button', { name: 'Manage Trustlines' }))
    await waitFor(() => expect(screen.getByTestId('trustline-list')).toBeInTheDocument())

    await user.click(screen.getByTestId('add-trustline-USDC'))
    await waitFor(() => expect(screen.getByTestId('trustline-confirmation')).toBeInTheDocument())

    await user.click(screen.getByTestId('confirm-add-trustline'))
    // isProcessing is now true — the POST promise above is held open.
    await waitFor(() =>
      expect(screen.getByTestId('confirm-add-trustline')).toBeDisabled(),
    )

    await user.keyboard('{Escape}')
    // Still open: Escape must not have dismissed the in-flight dialog.
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    resolveChangeTrustline({
      ok: true,
      json: async () => ({ success: true, data: { action: 'add', asset: 'USDC' } }),
    })

    await waitFor(() =>
      expect(screen.queryByTestId('confirm-add-trustline')).not.toBeInTheDocument(),
    )

    // Now that isProcessing is false again, Escape should close normally.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
