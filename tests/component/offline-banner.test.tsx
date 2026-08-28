/**
 * Issue #94 — OfflineBanner is the explicit, visible offline UI state
 * (rendered app-wide) rather than the app just going blank when the
 * network drops.
 */
import { render, screen, act } from '@testing-library/react'
import { OfflineBanner } from '../../components/ui/offline-banner'

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  })
}

describe('OfflineBanner', () => {
  afterEach(() => {
    setNavigatorOnLine(true)
  })

  it('renders nothing while online', () => {
    setNavigatorOnLine(true)
    render(<OfflineBanner />)
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument()
  })

  it('renders a visible status banner while offline', () => {
    setNavigatorOnLine(false)
    render(<OfflineBanner />)
    const banner = screen.getByTestId('offline-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveAttribute('role', 'status')
  })

  it('appears when connectivity is lost after mount and disappears when restored', () => {
    setNavigatorOnLine(true)
    render(<OfflineBanner />)
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument()

    act(() => {
      setNavigatorOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument()

    act(() => {
      setNavigatorOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument()
  })
})
