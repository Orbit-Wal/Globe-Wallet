import '@testing-library/jest-dom'
import { toHaveNoViolations } from 'jest-axe'
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util'

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = NodeTextEncoder
  globalThis.TextEncoder = NodeTextEncoder
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = NodeTextDecoder
  globalThis.TextDecoder = NodeTextDecoder
}

expect.extend(toHaveNoViolations)

const nodeRequest = global.Request || globalThis.Request
const nodeResponse = global.Response || globalThis.Response
const nodeHeaders = global.Headers || globalThis.Headers

if (typeof window !== 'undefined') {
  if (!window.Request && nodeRequest) {
    window.Request = nodeRequest
  }
  if (!window.Response && nodeResponse) {
    window.Response = nodeResponse
  }
  if (!window.Headers && nodeHeaders) {
    window.Headers = nodeHeaders
  }
}

if (!global.Request && nodeRequest) {
  global.Request = nodeRequest
}
if (!global.Response && nodeResponse) {
  global.Response = nodeResponse
}
if (!global.Headers && nodeHeaders) {
  global.Headers = nodeHeaders
}

const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
}

function installNavigatorMocks() {
  const navigators = []
  if (typeof global.navigator === 'object' && global.navigator !== null) {
    navigators.push(global.navigator)
  }
  if (typeof window !== 'undefined' && window.navigator && !navigators.includes(window.navigator)) {
    navigators.push(window.navigator)
  }
  if (navigators.length === 0) {
    return
  }

  for (const navigator of navigators) {
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    })
  }
}

installNavigatorMocks()

beforeEach(() => {
  installNavigatorMocks()
  mockClipboard.writeText.mockClear()
  mockClipboard.writeText.mockResolvedValue(undefined)
})
