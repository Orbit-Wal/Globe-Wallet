import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { ChartDailyDataPoint, ChartAnalyticsApiResponse } from '@/lib/types'
import { parseQuery } from '@/lib/api/http'

const QuerySchema = z.object({
  period: z.enum(['week', 'month', 'year']).optional(),
})

const WEEKLY_DATA: ChartDailyDataPoint[] = [
  { day: 'S', value: 45, label: 'Sunday' },
  { day: 'M', value: 75, label: 'Monday' },
  { day: 'T', value: 74, label: 'Tuesday' },
  { day: 'W', value: 92, label: 'Wednesday' },
  { day: 'T', value: 35, label: 'Thursday' },
  { day: 'F', value: 60, label: 'Friday' },
  { day: 'S', value: 50, label: 'Saturday' },
]

function computeStats(points: ChartDailyDataPoint[]) {
  const values = points.map((p) => p.value)
  const average = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  const peak = Math.max(...values)
  return { average, peak }
}

// Issue #68: intentionally PUBLIC — static, non-user-specific demo chart
// data (not derived from any account).
export async function GET(request: NextRequest): Promise<NextResponse<ChartAnalyticsApiResponse>> {
  const parsed = parseQuery(request, QuerySchema)
  if (!parsed.ok) return parsed.response as unknown as NextResponse<ChartAnalyticsApiResponse>
  const period = parsed.data.period ?? 'week'

  const points = WEEKLY_DATA
  const { average, peak } = computeStats(points)

  return NextResponse.json({
    success: true,
    data: { period, points, average, peak },
  })
}
