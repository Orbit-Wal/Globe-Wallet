/**
 * Next.js server instrumentation hook (https://nextjs.org/docs/app/guides/open-telemetry).
 * Runs once per server process before any request is handled.
 *
 * Issue #103: registers the service-layer tracer for server-side code
 * (API routes, and any BaseService methods invoked from them). Exports to
 * the console by default so traces are visible with zero extra setup; set
 * OTEL_EXPORTER_OTLP_ENDPOINT to ship spans to a real collector instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { initTracing } = await import('./lib/tracing/tracer')
  const { AsyncLocalStorageContextManager } = await import('@opentelemetry/context-async-hooks')
  const contextManager = new AsyncLocalStorageContextManager()

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (endpoint) {
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http')
    initTracing(new OTLPTraceExporter(), contextManager)
  } else {
    initTracing(undefined, contextManager)
  }
}
