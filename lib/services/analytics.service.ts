// Issue #146: this file used to also contain an `AnalyticsService` class
// (Issue #15's interval-based dashboard) that imported 7 types
// (IAnalyticsService, AnalyticsDashboard, AnalyticsRequest,
// AnalyticsMetricId, AnalyticsStat, ChartDataPoint, ChartInterval) that
// were never actually added to lib/types.ts — the class didn't typecheck
// and was never imported by app/api/analytics/route.ts (that route
// implements Issue #17's simpler period-based shape instead). Retired
// rather than finished: GET /api/analytics's shipped shape (period-based)
// is what tests/integration/chart-api.test.ts already covers correctly,
// and lib/analytics/chart-data.ts (only consumer: the removed class) was
// deleted alongside it. The functions below are unrelated (Issue #19 CI
// merge-analytics posting) and are still used by hooks/useAnalytics.ts.

/**
 * lib/services/analytics.service.ts
 * Issue #19: Analytics service for posting merge events and tracking CI metrics.
 *
 * This service handles posting merge analytics payloads to a configurable URL,
 * with retry logic and error handling.
 * All configuration is via environment variables — no secrets in code.
 */

import type { MergeAnalyticsPayloadV2, CIWorkflowStep } from "../types"

const DEFAULT_TIMEOUT = 10_000

/**
 * Post a merge analytics payload to the configured URL.
 * Returns true if the POST succeeded, false otherwise.
 * No secrets or sensitive data are included in the payload.
 */
export async function postMergeAnalytics(
  payload: MergeAnalyticsPayloadV2,
  url?: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<boolean> {
  const targetUrl = url ?? process.env.MERGE_ANALYTICS_URL ?? ""

  if (!targetUrl) {
    console.warn("[AnalyticsService] MERGE_ANALYTICS_URL not configured; skipping POST")
    return false
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!response.ok) {
      console.warn(`[AnalyticsService] POST returned ${response.status}`)
      return false
    }

    console.info("[AnalyticsService] Merge analytics posted successfully")
    return true
  } catch (error) {
    console.error("[AnalyticsService] Failed to post merge analytics:", error)
    return false
  }
}

/**
 * Build a MergeAnalyticsPayloadV2 from the given parameters.
 * Pure function, no side-effects.
 */
export function buildMergePayload(params: {
  repository: string
  branch: string
  commit: string
  author: string
  issue: number
  issues?: number[]
  coverageVerified?: boolean
  fixtureCoverageVerified?: boolean
  accessibilityVerified?: boolean
  testResults?: { total: number; passed: number; failed: number }
  status?: "success" | "failure"
}): MergeAnalyticsPayloadV2 {
  return {
    event: "merge",
    repository: params.repository,
    branch: params.branch,
    commit: params.commit,
    timestamp: new Date().toISOString(),
    author: params.author,
    issue: params.issue,
    issues: params.issues ?? [params.issue],
    status: params.status ?? "success",
    coverage_verified: params.coverageVerified ?? false,
    fixture_coverage_verified: params.fixtureCoverageVerified ?? false,
    accessibility_verified: params.accessibilityVerified ?? false,
    test_count: params.testResults?.total ?? 0,
    pass_count: params.testResults?.passed ?? 0,
    fail_count: params.testResults?.failed ?? 0,
  }
}

/**
 * Format a CI workflow step summary for logging and analytics.
 */
export function formatWorkflowSummary(steps: CIWorkflowStep[]): string {
  const total = steps.length
  const passed = steps.filter((s) => s.status === "success").length
  const failed = steps.filter((s) => s.status === "failure").length
  const totalDuration = steps.reduce((sum, s) => sum + s.durationMs, 0)

  return [
    `Workflow completed: ${passed}/${total} steps passed, ${failed} failed`,
    `Total duration: ${(totalDuration / 1000).toFixed(2)}s`,
    ...steps.map(
      (s) => `  [${s.status.toUpperCase()}] ${s.name} (${s.durationMs}ms)`,
    ),
  ].join("\n")
}
