/** @jest-environment node */
/**
 * tests/integration/health-api.test.ts
 * Issue #19: Integration tests for the /api/health endpoint.
 * Verifies the health check response shape and service status.
 */

import { GET } from "@/app/api/health/route"
import type { HealthCheckResponse } from "@/lib/types"

describe("GET /api/health", () => {
  it("should return a healthy status with version and uptime", async () => {
    const response = await GET()
    const body: HealthCheckResponse = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe("healthy")
    expect(body.version).toBe("1.0.0")
    expect(body.uptime).toBeGreaterThanOrEqual(0)
  })

  it("should report all services as up", async () => {
    const response = await GET()
    const body: HealthCheckResponse = await response.json()

    expect(body.services).toBeDefined()
    expect(Object.keys(body.services).length).toBeGreaterThan(0)

    for (const [, status] of Object.entries(body.services)) {
      expect(status).toBe("up")
    }
  })

  it("should return proper content type", async () => {
    const response = await GET()

    expect(response.headers.get("content-type")).toContain("application/json")
  })

  it("should return a valid HealthCheckResponse shape", async () => {
    const response = await GET()
    const body: HealthCheckResponse = await response.json()

    // Verify the exact shape
    expect(body).toMatchObject({
      status: "healthy",
      version: expect.any(String),
      uptime: expect.any(Number),
      services: expect.any(Object),
    })
  })
})
