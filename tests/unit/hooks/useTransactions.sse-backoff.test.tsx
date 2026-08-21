/**
 * Issue #79: useTransactions' SSE subscription must clean up on unmount and
 * back off (not retry at a fixed interval forever) on repeated stream
 * failures. jsdom doesn't ship a real EventSource, so this installs a
 * scriptable fake on `global.EventSource` to drive the hook's onopen/onerror
 * handlers directly and assert the reconnection behavior around them.
 */
import { renderHook, act } from '@testing-library/react'
import { useTransactions } from '../../../hooks/useTransactions'
import { FinanceServicesProvider } from '../../../hooks/useFinanceServices'
import { FinanceServiceContainer } from '../../../lib/services/container'
import React from 'react'

const mockWallet = {
  getTransactionHistory: jest.fn().mockResolvedValue([]),
  getAccountInfo: jest.fn(),
  getBalance: jest.fn(),
  sendPayment: jest.fn(),
  generateReceiveAddress: jest.fn(),
  validateAddress: jest.fn(),
  shortenKey: jest.fn(),
}

const mockFiat = {
  getAccountBalance: jest.fn().mockReturnValue(1000),
  getWallets: jest.fn().mockReturnValue([]),
  formatMoney: jest.fn((amount: number) => `$${amount}`),
  convertCurrency: jest.fn().mockReturnValue(100),
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FinanceServicesProvider
    services={
      new FinanceServiceContainer(mockWallet as any, undefined, undefined, mockFiat as any)
    }
  >
    {children}
  </FinanceServicesProvider>
)

class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  closed = false
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  private listeners: Record<string, ((e: MessageEvent) => void)[]> = {}

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners[type] = this.listeners[type] ?? []
    this.listeners[type].push(cb)
  }

  removeEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== cb)
  }

  close() {
    this.closed = true
  }

  emitOpen() {
    this.onopen?.()
  }

  emitError() {
    this.onerror?.()
  }
}

describe('useTransactions SSE reconnection (Issue #79)', () => {
  const originalEventSource = (global as any).EventSource

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    FakeEventSource.instances = []
    ;(global as any).EventSource = FakeEventSource
  })

  afterEach(() => {
    jest.useRealTimers()
    ;(global as any).EventSource = originalEventSource
  })

  it('closes the EventSource and clears pending reconnect timers on unmount', () => {
    const { unmount } = renderHook(() => useTransactions(), { wrapper })

    expect(FakeEventSource.instances).toHaveLength(1)
    const first = FakeEventSource.instances[0]
    expect(first.closed).toBe(false)

    unmount()

    expect(first.closed).toBe(true)
    // No further reconnect should be scheduled/created after unmount, even
    // once pending timers would otherwise fire.
    act(() => {
      jest.runOnlyPendingTimers()
    })
    expect(FakeEventSource.instances).toHaveLength(1)
  })

  it('reconnects with exponentially increasing delay after each failure, not a fixed interval', () => {
    renderHook(() => useTransactions(), { wrapper })
    expect(FakeEventSource.instances).toHaveLength(1)

    // 1st failure -> base delay (1000ms)
    act(() => {
      FakeEventSource.instances[0].emitError()
    })
    act(() => {
      jest.advanceTimersByTime(999)
    })
    expect(FakeEventSource.instances).toHaveLength(1) // not yet reconnected
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(FakeEventSource.instances).toHaveLength(2) // reconnected at 1000ms

    // 2nd consecutive failure -> delay doubles to 2000ms
    act(() => {
      FakeEventSource.instances[1].emitError()
    })
    act(() => {
      jest.advanceTimersByTime(1999)
    })
    expect(FakeEventSource.instances).toHaveLength(2)
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(FakeEventSource.instances).toHaveLength(3)
  })

  it('resets the backoff after a successful connection (onopen)', () => {
    renderHook(() => useTransactions(), { wrapper })

    act(() => {
      FakeEventSource.instances[0].emitError()
    })
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(FakeEventSource.instances).toHaveLength(2)

    // Successful reconnect resets the failure count.
    act(() => {
      FakeEventSource.instances[1].emitOpen()
    })
    act(() => {
      FakeEventSource.instances[1].emitError()
    })
    act(() => {
      jest.advanceTimersByTime(999)
    })
    expect(FakeEventSource.instances).toHaveLength(2) // still base delay, not doubled again
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(FakeEventSource.instances).toHaveLength(3)
  })

  it('stops retrying and exposes liveUpdatesPaused after repeated consecutive failures', () => {
    const { result } = renderHook(() => useTransactions(), { wrapper })
    expect(result.current.liveUpdatesPaused).toBe(false)

    // Drive through SSE_MAX_CONSECUTIVE_FAILURES (6) failures, advancing
    // whatever the current backoff delay is each time.
    let delay = 1000
    for (let i = 0; i < 5; i++) {
      const last = FakeEventSource.instances[FakeEventSource.instances.length - 1]
      act(() => {
        last.emitError()
      })
      act(() => {
        jest.advanceTimersByTime(delay)
      })
      delay = Math.min(delay * 2, 30_000)
    }
    // 5 failures handled so far, 5 reconnects created (total 6 instances).
    expect(FakeEventSource.instances).toHaveLength(6)
    expect(result.current.liveUpdatesPaused).toBe(false)

    // 6th failure hits SSE_MAX_CONSECUTIVE_FAILURES -> pause, no more reconnects.
    const last = FakeEventSource.instances[FakeEventSource.instances.length - 1]
    act(() => {
      last.emitError()
    })
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(FakeEventSource.instances).toHaveLength(6) // no 7th reconnect
    expect(result.current.liveUpdatesPaused).toBe(true)
  })
})
