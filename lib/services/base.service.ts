import { ServiceError, StellarServiceError } from '../types'
import { withSpan } from '../tracing/tracer'
import type { Span } from '@opentelemetry/api'

/**
 * Level 2 Architecture Sync: Base Service Abstraction
 * Provides standardized enterprise features: Logging, Error Translation, and Lifecycle hooks.
 */
export abstract class BaseService {
    protected readonly serviceName: string

    constructor(serviceName: string) {
        this.serviceName = serviceName
    }

    /**
     * Standardized error handling to map internal errors to user-friendly messages
     * as defined in issue-27.md Error Code Mapping.
     */
    protected handleError(error: any, context: string): never {
        if (process.env.NODE_ENV !== 'test') {
            console.error(`[${this.serviceName}] Error in ${context}:`, error)
        }

        if (error instanceof ServiceError) {
            throw error
        }

        // Map typical network/logic errors to custom domain errors
        const message = error?.message || 'An unexpected service error occurred'
        throw new StellarServiceError(`[${this.serviceName}] ${message}`)
    }

    /**
     * Issue #103: service-boundary tracing. Each call becomes a real OTel span
     * (service.name/operation.name attributes, recorded exceptions, OK/ERROR
     * status) instead of a local console.debug timer with no cross-service
     * correlation — see lib/tracing/tracer.ts for exporter/propagator setup.
     *
     * `operation` optionally receives the active span so a caller that awaits
     * something *before* making a real network call (see wallet.service.ts's
     * sendPayment) can capture the trace context up front — via
     * `context.active()` — and forward it explicitly to injectTraceHeaders(),
     * rather than relying on it still being "active" after an await resumes.
     */
    protected async withPerformanceTracking<T>(
        operationName: string,
        operation: (span: Span) => Promise<T>
    ): Promise<T> {
        return withSpan(`${this.serviceName}.${operationName}`, (span) => operation(span), {
            'service.name': this.serviceName,
            'operation.name': operationName,
        })
    }
}
