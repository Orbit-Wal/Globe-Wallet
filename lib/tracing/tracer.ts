import {
  context,
  propagation,
  trace,
  SpanStatusCode,
  ROOT_CONTEXT,
  type Attributes,
  type Context,
  type ContextManager,
  type Span,
} from '@opentelemetry/api'
import {
  BasicTracerProvider,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { W3CTraceContextPropagator } from '@opentelemetry/core'

/**
 * Issue #103 — service-layer OpenTelemetry tracing.
 *
 * Isomorphic on purpose: this module only touches `@opentelemetry/api` and
 * `sdk-trace-base`, both of which run unmodified in the browser, in Next.js
 * API routes, and under Jest/jsdom. Runtime-specific bootstrap (which
 * exporter, when to register) lives in `instrumentation.ts` (server) and
 * `lib/tracing/browser-tracer.ts` (client) — this file stays side-effect
 * free so importing it from a service never risks patching globals twice.
 */

const TRACER_NAME = 'globe-wallet-service-layer'
const SERVICE_NAME = 'globe-wallet'

let initialized = false

/**
 * Minimal, dependency-free ContextManager. Tracks the active context through
 * nested *synchronous* calls only — no AsyncLocalStorage, no Zone.js — which
 * is exactly what this codebase needs: `injectTraceHeaders()` always runs
 * synchronously inside a span's callback, before the one `await fetch(...)`
 * that crosses a real network boundary. This is the browser-safe default;
 * Node's `register()` in instrumentation.ts swaps in
 * `AsyncLocalStorageContextManager` for context that survives multiple
 * `await`s within a single API route handler.
 */
class SyncStackContextManager implements ContextManager {
  private readonly stack: Context[] = [ROOT_CONTEXT]

  active(): Context {
    return this.stack[this.stack.length - 1]
  }

  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    ctx: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    this.stack.push(ctx)
    try {
      return fn.apply(thisArg, args)
    } finally {
      this.stack.pop()
    }
  }

  bind<T>(_ctx: Context, target: T): T {
    return target
  }

  enable(): this {
    return this
  }

  disable(): this {
    this.stack.length = 0
    this.stack.push(ROOT_CONTEXT)
    return this
  }
}

/**
 * Registers a global TracerProvider, W3C propagator, and context manager.
 * Safe to call more than once — only the first call wins, so it can be
 * invoked defensively from server bootstrap, browser bootstrap, and tests.
 */
export function initTracing(
  exporter: SpanExporter = new ConsoleSpanExporter(),
  contextManager: ContextManager = new SyncStackContextManager(),
): void {
  if (initialized) return
  initialized = true

  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: SERVICE_NAME }),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  })

  trace.setGlobalTracerProvider(provider)
  propagation.setGlobalPropagator(new W3CTraceContextPropagator())
  context.setGlobalContextManager(contextManager)
}

/** True once initTracing() has run in this runtime (Node process or browser tab). */
export function isTracingInitialized(): boolean {
  return initialized
}

function getTracer() {
  return trace.getTracer(TRACER_NAME)
}

/**
 * Wraps an operation in a span. Duration is recorded as both a span
 * attribute (`duration_ms`, for continuity with the old withPerformanceTracking
 * console output) and, natively, as the span's own start/end timestamps.
 * Errors are recorded on the span and rethrown — this never swallows.
 */
export async function withSpan<T>(
  name: string,
  operation: (span: Span) => Promise<T> | T,
  attributes: Attributes = {},
): Promise<T> {
  return getTracer().startActiveSpan(name, async (span) => {
    span.setAttributes(attributes)
    const start = performance.now()
    try {
      const result = await operation(span)
      span.setAttribute('duration_ms', Number((performance.now() - start).toFixed(2)))
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setAttribute('duration_ms', Number((performance.now() - start).toFixed(2)))
      span.recordException(error as Error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Injects a span's W3C trace context (traceparent/tracestate) into outgoing
 * request headers, so the receiving side can continue the trace. With no
 * TracerProvider registered (e.g. Jest), the global propagator is a no-op
 * and this simply returns the headers unchanged.
 *
 * Defaults to `context.active()`, which is only reliable for the synchronous
 * portion of a span's callback — this codebase has no Zone.js/AsyncLocalStorage
 * in the browser, so context does not survive an `await`. A caller that needs
 * to inject *after* awaiting something should capture `context.active()` at
 * the top of its span callback (before any await) and pass it explicitly.
 */
export function injectTraceHeaders(existing: HeadersInit = {}, ctx: Context = context.active()): Headers {
  const headers = new Headers(existing)
  const carrier: Record<string, string> = {}
  propagation.inject(ctx, carrier)
  for (const [key, value] of Object.entries(carrier)) {
    headers.set(key, value)
  }
  return headers
}

/**
 * Extracts a W3C trace context from incoming request headers, returning a
 * Context that can be activated with `context.with()` so server-side spans
 * become children of the caller's trace instead of starting new traces.
 */
export function extractTraceContext(headers: Headers): Context {
  const carrier: Record<string, string> = {}
  headers.forEach((value, key) => {
    carrier[key] = value
  })
  return propagation.extract(context.active(), carrier)
}

export { context }
