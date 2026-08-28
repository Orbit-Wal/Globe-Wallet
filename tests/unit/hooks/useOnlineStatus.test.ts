/**
 * Issue #94 — useOnlineStatus tracks navigator.onLine + the online/offline
 * window events so UI can react to connectivity loss explicitly.
 */
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from '../../../hooks/useOnlineStatus'

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  })
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    setNavigatorOnLine(true)
  })

  it('initializes from navigator.onLine', () => {
    setNavigatorOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('flips to false when the offline event fires', () => {
    setNavigatorOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())

    act(() => {
      setNavigatorOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
  })

  it('flips back to true when the online event fires', () => {
    setNavigatorOnLine(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)

    act(() => {
      setNavigatorOnLine(true)
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current).toBe(true)
  })

  it('removes its listeners on unmount', () => {
    const addSpy = jest.spyOn(window, 'addEventListener')
    const removeSpy = jest.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useOnlineStatus())
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
