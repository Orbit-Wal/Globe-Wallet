/**
 * Issue #66: SSRF protections for the real (server-side) SEP-0002 federation
 * fetch — a user-controlled domain now drives two outbound HTTP requests
 * (stellar.toml, then FEDERATION_SERVER), so both must be guarded against
 * being pointed at internal/private infrastructure.
 */
import { lookup as dnsLookup } from 'node:dns/promises'

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfBlockedError'
  }
}

const FETCH_TIMEOUT_MS = 5000
const MAX_RESPONSE_BYTES = 100 * 1024 // stellar.toml / federation responses are tiny; 100KB is generous

function isPrivateOrReservedIp(ip: string): boolean {
  if (ip.includes(':')) {
    const lower = ip.toLowerCase()
    return (
      lower === '::1' || // loopback
      lower.startsWith('fe80:') || // link-local
      lower.startsWith('fc') || lower.startsWith('fd') || // unique local (fc00::/7)
      lower.startsWith('::ffff:127.') || lower.startsWith('::ffff:10.') // IPv4-mapped private
    )
  }
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true // malformed — fail closed
  const [a, b] = parts
  return (
    a === 127 || // loopback
    a === 10 || // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 169 && b === 254) || // link-local
    a === 0 ||
    a >= 224 // multicast/reserved
  )
}

/** Resolves `hostname` and throws if it points at a private/loopback/link-local address. */
async function assertPublicHostname(hostname: string): Promise<void> {
  let addresses: { address: string }[]
  try {
    addresses = await dnsLookup(hostname, { all: true })
  } catch (err) {
    throw new SsrfBlockedError(`Could not resolve host: ${hostname}`)
  }
  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new SsrfBlockedError(`Host ${hostname} resolves to a private/reserved address`)
    }
  }
}

/**
 * A fetch() wrapper safe to call with a user-influenced URL: enforces https,
 * resolves and validates the hostname isn't private/loopback/link-local
 * before connecting, times out, and caps the response body size.
 */
export async function ssrfSafeFetch(url: string): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new SsrfBlockedError(`Invalid URL: ${url}`)
  }
  if (parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(`Only https:// URLs are allowed, got: ${parsed.protocol}`)
  }

  await assertPublicHostname(parsed.hostname)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(parsed.toString(), { signal: controller.signal, redirect: 'error' })
    if (!res.ok) {
      throw new SsrfBlockedError(`Request to ${parsed.hostname} failed with status ${res.status}`)
    }
    const reader = res.body?.getReader()
    if (!reader) return await res.text()

    let received = 0
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_RESPONSE_BYTES) {
        throw new SsrfBlockedError(`Response from ${parsed.hostname} exceeded ${MAX_RESPONSE_BYTES} bytes`)
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
  } finally {
    clearTimeout(timer)
  }
}
