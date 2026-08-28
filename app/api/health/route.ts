import { NextResponse } from "next/server"
import type { HealthCheckResponse } from "@/lib/types"

/**
 * GET /api/health
 * Issue #19: Health check endpoint for CI/CD monitoring.
 * Returns service status, version, and uptime.
 *
 * Issue #68: intentionally PUBLIC — CI/monitoring probes this before any
 * session exists, and it returns no user or wallet data.
 */
export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const start = process.uptime()

  return NextResponse.json({
    status: "healthy",
    version: "1.0.0",
    uptime: Math.floor(start),
    services: {
      api: "up",
      mockDb: "up",
    },
  })
}
