import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base'
import { SpanStatusCode } from '@opentelemetry/api'
import {
  initTracing,
  withSpan,
  injectTraceHeaders,
  extractTraceContext,
  context,
} from '../../../lib/tracing/tracer'

describe('lib/tracing/tracer (Issue #103)', () => {
  const exporter = new InMemorySpanExporter()

  beforeAll(() => {
    initTracing(exporter)
  })

  beforeEach(() => {
    exporter.reset()
  })

  describe('withSpan', () => {
    it('records a successful span with attributes, duration, and OK status', async () => {
      const result = await withSpan('test.op', async () => 'ok', { 'custom.attr': 'x' })

      expect(result).toBe('ok')
      const spans = exporter.getFinishedSpans()
      expect(spans).toHaveLength(1)
      expect(spans[0].name).toBe('test.op')
      expect(spans[0].status.code).toBe(SpanStatusCode.OK)
      expect(spans[0].attributes['custom.attr']).toBe('x')
      expect(typeof spans[0].attributes['duration_ms']).toBe('number')
    })

    it('records exceptions, sets ERROR status, and rethrows without swallowing', async () => {
      await expect(
        withSpan('test.fail', async () => {
          throw new Error('boom')
        }),
      ).rejects.toThrow('boom')

      const spans = exporter.getFinishedSpans()
      expect(spans).toHaveLength(1)
      expect(spans[0].status.code).toBe(SpanStatusCode.ERROR)
      expect(spans[0].status.message).toBe('boom')
      expect(spans[0].events.some((e) => e.name === 'exception')).toBe(true)
    })
  })

  describe('injectTraceHeaders / extractTraceContext (trace propagation)', () => {
    it('injects a valid W3C traceparent header from the active span', async () => {
      let headers: Headers | undefined

      await withSpan('test.inject', async () => {
        headers = injectTraceHeaders({ 'Content-Type': 'application/json' })
      })

      expect(headers!.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/)
      expect(headers!.get('Content-Type')).toBe('application/json')
    })

    it('round-trips a traceparent header so the receiving span continues the same trace', async () => {
      let traceparent = ''

      await withSpan('client.parent', async () => {
        traceparent = injectTraceHeaders().get('traceparent')!
      })
      const parentTraceId = traceparent.split('-')[1]

      const extracted = extractTraceContext(new Headers({ traceparent }))
      let childTraceId = ''
      await context.with(extracted, async () => {
        await withSpan('server.child', async (span) => {
          childTraceId = span.spanContext().traceId
        })
      })

      expect(childTraceId).toBe(parentTraceId)
    })

    it('returns a usable context when no traceparent header is present', () => {
      const ctx = extractTraceContext(new Headers())
      expect(ctx).toBeDefined()
    })
  })
})
